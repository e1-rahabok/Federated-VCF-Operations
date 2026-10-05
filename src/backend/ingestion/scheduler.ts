import { getDatabase } from '../db/database.ts';
import { WatermarkManager } from './watermark.ts';
import { type VcfAlert, type VcfAlertCondition, type VcfInstanceConfig, type VcfOpsApiClient, type VcfProperty, type VcfRelation, type VcfResource } from './client.ts';
import { RollupAggregator } from './rollup.ts';
import { activePropertyKeysByKind, activeStatKeysByKind, loadMetricsConfig } from './collectionRules.ts';
import { getClient, listEnabledInstances } from './clientRegistry.ts';
import { getRetention } from '../settings.ts';

// Alert queries overlap the previous window by this much; upserts make the overlap harmless.
const ALERT_WINDOW_OVERLAP_MS = 60 * 1000;
// After an outage, metric samples older than this are not requested (REQ-TEC-014).
const MAX_METRIC_CATCHUP_MS = 6 * 60 * 60 * 1000;
// Expired rows are deleted at most this often.
const PURGE_INTERVAL_MS = 10 * 60 * 1000;
// Consecutive failed polls before an instance's circuit breaker opens.
const CIRCUIT_FAILURE_THRESHOLD = 3;
// Object kinds shown as the parent hierarchy of a tracked resource.
const ANCESTOR_KINDS = ['VMwareAdapter Instance', 'Datacenter', 'ClusterComputeResource', 'HostSystem'];
// Kinds whose datastores are looked up (datastores are children of the objects using them).
const DATASTORE_CONSUMER_KINDS = ['VirtualMachine', 'HostSystem'];

export interface SchedulerOptions {
  // Properties and relationships change rarely, so they are refreshed on this slower cadence.
  inventoryDetailRefreshSeconds?: number;
  // An open circuit breaker waits this long before one trial poll. Each failed trial doubles
  // the wait, up to the maximum (REQ-TEC-013).
  circuitBreakerCooldownSeconds?: number;
  circuitBreakerMaxCooldownSeconds?: number;
}

interface CircuitBreaker {
  consecutiveFailures: number;
  isOpen: boolean;
  // While open: when the next trial poll is allowed, and the wait that led to it.
  retryAt: number;
  cooldownMs: number;
  // Connection settings the failures were recorded against.
  fingerprint: string;
}

interface CollectionRules {
  statKeysByKind: Record<string, string[]>;
  propertyKeysByKind: Record<string, string[]>;
}

interface InventoryDetail {
  properties: VcfProperty[];
  relations: Array<VcfRelation & { relation: 'ANCESTOR' | 'DATASTORE' }>;
}

export class PollingScheduler {
  private intervalSeconds: number;
  private inventoryDetailRefreshMs: number;
  private isRunning: boolean = false;
  private cycleInFlight: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private watermarkMgr: WatermarkManager;
  private rollupAggregator: RollupAggregator;
  private circuitBreakerMap: Map<string, CircuitBreaker> = new Map();
  private circuitCooldownMs: number;
  private circuitMaxCooldownMs: number;
  private lastInventoryDetailRefresh: Map<string, number> = new Map();
  private lastPurge: number = 0;

  constructor(intervalSeconds: number = 60, options: SchedulerOptions = {}) {
    this.intervalSeconds = intervalSeconds;
    this.inventoryDetailRefreshMs = (options.inventoryDetailRefreshSeconds ?? 15 * 60) * 1000;
    this.circuitCooldownMs = (options.circuitBreakerCooldownSeconds ?? 2 * 60) * 1000;
    this.circuitMaxCooldownMs = (options.circuitBreakerMaxCooldownSeconds ?? 15 * 60) * 1000;
    this.watermarkMgr = new WatermarkManager();
    this.rollupAggregator = new RollupAggregator();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Scheduler] Starting VCF 9 polling loop every ${this.intervalSeconds}s`);

    this.executePollingCycle().catch(err => console.error('[Scheduler] Error in polling cycle:', err));

    this.timer = setInterval(() => {
      this.executePollingCycle().catch(err => console.error('[Scheduler] Error in polling cycle:', err));
    }, this.intervalSeconds * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[Scheduler] Polling loop stopped');
  }

  public async executePollingCycle(): Promise<void> {
    if (this.cycleInFlight) {
      console.warn('[Scheduler] Previous polling cycle still running. Skipping this tick.');
      return;
    }
    this.cycleInFlight = true;

    try {
      const config = loadMetricsConfig();
      const rules: CollectionRules = {
        statKeysByKind: activeStatKeysByKind(config),
        propertyKeysByKind: activePropertyKeysByKind(config)
      };

      // Instances are polled concurrently; one slow or failing instance never delays the others.
      await Promise.all(listEnabledInstances().map(instance => this.pollInstance(instance, rules)));

      await this.rollupAggregator.compute5MinRollups();
      await this.purgeExpiredData();
    } finally {
      this.cycleInFlight = false;
    }
  }

  /** Deletes rows older than the retention saved in Settings (or the environment defaults). */
  private async purgeExpiredData(): Promise<void> {
    if (Date.now() - this.lastPurge < PURGE_INTERVAL_MS) return;
    this.lastPurge = Date.now();

    const retention = getRetention();
    const rawPurged = await this.rollupAggregator.purgeExpiredRawMetrics(retention.rawHours);
    const summaryPurged = await this.rollupAggregator.purgeExpiredSummaryMetrics(retention.summaryDays);
    if (rawPurged || summaryPurged) {
      console.log(`[Scheduler] Retention purge removed ${rawPurged} raw samples and ${summaryPurged} summary rows.`);
    }
  }

  private async pollInstance(instance: VcfInstanceConfig, rules: CollectionRules): Promise<void> {
    // Failures are counted against the connection settings they happened with: when an
    // administrator edits the instance (new password, hostname, ...) the breaker starts fresh.
    const fingerprint = JSON.stringify(instance);
    let cb = this.circuitBreakerMap.get(instance.id);
    if (!cb || cb.fingerprint !== fingerprint) {
      cb = { consecutiveFailures: 0, isOpen: false, retryAt: 0, cooldownMs: this.circuitCooldownMs, fingerprint };
      this.circuitBreakerMap.set(instance.id, cb);
    }
    if (cb.isOpen && Date.now() < cb.retryAt) {
      return;
    }
    if (cb.isOpen) {
      console.log(`[Scheduler] Circuit breaker half-open for instance ${instance.name}. Trying one poll.`);
    }

    const db = getDatabase();

    try {
      const client = getClient(instance);
      const cycleStart = Date.now();
      const metricsWatermark = await this.watermarkMgr.getLastWatermark(instance.id, 'METRICS');
      const alertsWatermark = this.watermarkMgr.getStoredWatermark(instance.id, 'ALERTS');

      // --- Collect from VCF Operations (network) ---
      const objects = await client.fetchObjects(Object.keys(rules.statKeysByKind));

      const metricsBegin = Math.max(metricsWatermark + 1, cycleStart - MAX_METRIC_CATCHUP_MS);
      const metrics = [];
      for (const [kind, statKeys] of Object.entries(rules.statKeysByKind)) {
        const uuids = objects.filter(o => o.kind === kind).map(o => o.uuid);
        metrics.push(...await client.fetchMetricsDelta(uuids, statKeys, metricsBegin, cycleStart));
      }

      const alerts = await this.fetchAlertChanges(client, alertsWatermark, cycleStart);

      // Enrichment (alert conditions, properties, relationships) is collected after the core
      // data. If it fails, the core data is still stored and the instance is marked DEGRADED.
      let enrichmentError: string | null = null;
      let alertConditions: VcfAlertCondition[] = [];
      let inventoryDetail: InventoryDetail | null = null;
      try {
        alertConditions = await client.fetchAlertConditions(alerts.map(a => a.alertId));
        if (cycleStart - (this.lastInventoryDetailRefresh.get(instance.id) || 0) >= this.inventoryDetailRefreshMs) {
          inventoryDetail = await this.fetchInventoryDetail(client, objects, rules.propertyKeysByKind);
        }
      } catch (err: any) {
        enrichmentError = `Collected metrics and alerts, but not properties/relationships/alert conditions: ${err?.message || err}`;
        console.warn(`[Scheduler] ${instance.name}: ${enrichmentError}`);
      }

      // --- Persist (synchronous, one transaction per instance) ---
      const nameByUuid = new Map(objects.map(o => [o.uuid, o.name]));
      let maxMetricTimestamp = metricsWatermark;
      let maxAlertTimestamp = alertsWatermark ?? cycleStart - ALERT_WINDOW_OVERLAP_MS;

      db.exec('BEGIN');
      try {
        const resStmt = db.prepare('INSERT OR REPLACE INTO resources (instance_id, resource_uuid, resource_name, resource_kind, adapter_kind, last_seen) VALUES (?, ?, ?, ?, ?, ?)');
        for (const obj of objects) {
          resStmt.run(instance.id, obj.uuid, obj.name, obj.kind, obj.adapterKind, cycleStart);
        }

        const metricStmt = db.prepare('INSERT OR IGNORE INTO raw_metrics (instance_id, resource_uuid, stat_key, timestamp, stat_value) VALUES (?, ?, ?, ?, ?)');
        for (const m of metrics) {
          metricStmt.run(instance.id, m.resourceUuid, m.statKey, m.timestamp, m.statValue);
          if (m.timestamp > maxMetricTimestamp) maxMetricTimestamp = m.timestamp;
        }

        const alertStmt = db.prepare('INSERT OR REPLACE INTO alerts (alert_id, instance_id, resource_uuid, resource_name, alert_name, severity, status, start_time, update_time, cancel_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const a of alerts) {
          alertStmt.run(a.alertId, instance.id, a.resourceUuid, nameByUuid.get(a.resourceUuid) || null, a.alertName, a.severity, a.status, a.startTime, a.updateTime, a.cancelTime);
          const latest = Math.max(a.updateTime, a.cancelTime || 0);
          if (latest > maxAlertTimestamp) maxAlertTimestamp = latest;
        }

        const conditionStmt = db.prepare('INSERT OR REPLACE INTO alert_conditions (instance_id, alert_id, symptom_id, stat_key, operator, threshold, severity) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const c of alertConditions) {
          conditionStmt.run(instance.id, c.alertId, c.symptomId, c.statKey, c.operator, c.threshold, c.severity);
        }

        if (inventoryDetail) {
          const propStmt = db.prepare('INSERT OR REPLACE INTO resource_properties (instance_id, resource_uuid, property_key, property_value, updated_at) VALUES (?, ?, ?, ?, ?)');
          for (const p of inventoryDetail.properties) {
            propStmt.run(instance.id, p.resourceUuid, p.key, p.value, cycleStart);
          }

          // Relationships are replaced as a whole so removed links (e.g. after a vMotion) disappear.
          db.prepare('DELETE FROM resource_relations WHERE instance_id = ?').run(instance.id);
          const relStmt = db.prepare('INSERT OR REPLACE INTO resource_relations (instance_id, resource_uuid, relation, related_uuid, related_name, related_kind) VALUES (?, ?, ?, ?, ?, ?)');
          for (const r of inventoryDetail.relations) {
            relStmt.run(instance.id, r.resourceUuid, r.relation, r.relatedUuid, r.relatedName, r.relatedKind);
          }
        }

        db.prepare('UPDATE vcf_instances SET status = ?, last_poll = ?, last_error = ? WHERE id = ?')
          .run(enrichmentError ? 'DEGRADED' : 'HEALTHY', cycleStart, enrichmentError, instance.id);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      if (inventoryDetail) this.lastInventoryDetailRefresh.set(instance.id, cycleStart);
      await this.watermarkMgr.updateWatermark(instance.id, 'METRICS', maxMetricTimestamp);
      await this.watermarkMgr.updateWatermark(instance.id, 'ALERTS', maxAlertTimestamp);
      if (cb.isOpen) {
        console.log(`[Scheduler] Instance ${instance.name} recovered. Circuit breaker closed.`);
      }
      cb.consecutiveFailures = 0;
      cb.isOpen = false;
      cb.cooldownMs = this.circuitCooldownMs;

    } catch (err: any) {
      const message = String(err?.message || err);
      console.error(`[Scheduler] Error polling instance ${instance.name}:`, message);
      cb.consecutiveFailures += 1;

      let note = '';
      if (cb.isOpen) {
        // The trial poll failed: stay open and wait twice as long before the next trial.
        cb.cooldownMs = Math.min(cb.cooldownMs * 2, this.circuitMaxCooldownMs);
      } else if (cb.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        cb.isOpen = true;
        cb.cooldownMs = this.circuitCooldownMs;
      }
      if (cb.isOpen) {
        cb.retryAt = Date.now() + cb.cooldownMs;
        note = ` (polling paused after ${cb.consecutiveFailures} consecutive failures; next attempt ${new Date(cb.retryAt).toISOString()})`;
        console.warn(`[Scheduler] Circuit breaker OPEN for instance ${instance.name}. Next attempt in ${Math.round(cb.cooldownMs / 1000)}s.`);
      }
      db.prepare("UPDATE vcf_instances SET status = 'ERROR', last_error = ? WHERE id = ?").run(message + note, instance.id);
    }
  }

  /** Properties listed in metrics_list.yaml plus the ancestors and datastores of every tracked resource. */
  private async fetchInventoryDetail(client: VcfOpsApiClient, objects: VcfResource[], propertyKeysByKind: Record<string, string[]>): Promise<InventoryDetail> {
    const properties: VcfProperty[] = [];
    for (const [kind, propertyKeys] of Object.entries(propertyKeysByKind)) {
      const uuids = objects.filter(o => o.kind === kind).map(o => o.uuid);
      properties.push(...await client.fetchProperties(uuids, propertyKeys));
    }

    const ancestors = await client.fetchRelated(objects.map(o => o.uuid), 'ANCESTOR', ANCESTOR_KINDS);
    const consumers = objects.filter(o => DATASTORE_CONSUMER_KINDS.includes(o.kind)).map(o => o.uuid);
    const datastores = await client.fetchRelated(consumers, 'CHILD', ['Datastore']);

    return {
      properties,
      relations: [
        ...ancestors.map(r => ({ ...r, relation: 'ANCESTOR' as const })),
        ...datastores.map(r => ({ ...r, relation: 'DATASTORE' as const }))
      ]
    };
  }

  /**
   * First poll of an instance takes every active alert. Later polls take only alerts
   * updated or canceled since the watermark (REQ-FUN-015).
   */
  private async fetchAlertChanges(client: VcfOpsApiClient, watermark: number | null, now: number): Promise<VcfAlert[]> {
    if (watermark === null) {
      return client.fetchAlerts({ activeOnly: true });
    }

    const range = { startTime: watermark + 1, endTime: now };
    const updated = await client.fetchAlerts({ updateTimeRange: range });
    const canceled = await client.fetchAlerts({ cancelTimeRange: range });

    const byId = new Map<string, VcfAlert>();
    for (const a of [...updated, ...canceled]) byId.set(a.alertId, a);
    return Array.from(byId.values());
  }
}
