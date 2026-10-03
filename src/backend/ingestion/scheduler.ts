import { getDatabase } from '../db/database.ts';
import { WatermarkManager } from './watermark.ts';
import { VcfOpsApiClient, type VcfInstanceConfig } from './client.ts';
import { RollupAggregator } from './rollup.ts';

export class PollingScheduler {
  private intervalSeconds: number;
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;
  private watermarkMgr: WatermarkManager;
  private rollupAggregator: RollupAggregator;
  private circuitBreakerMap: Map<string, { consecutiveFailures: number; isOpen: boolean }> = new Map();

  constructor(intervalSeconds: number = 60) {
    this.intervalSeconds = intervalSeconds;
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
    const db = getDatabase();
    let instances: VcfInstanceConfig[] = [];

    try {
      const stmt = db.prepare('SELECT id, name, hostname, auth_type as authType, username, password_encrypted as passwordEncrypted, vidb_host as vidbHost, client_id as clientId, refresh_token_encrypted as refreshTokenEncrypted FROM vcf_instances WHERE enabled = 1');
      instances = stmt.all() || [];
    } catch (err) {
      instances = [
        { id: 'vcf-ops-01', name: 'VCF-Ops-01 (Datacenter East)', hostname: 'vcf-ops-01.corp.local', authType: 'OPS_TOKEN' },
        { id: 'vcf-ops-02', name: 'VCF-Ops-02 (Datacenter West)', hostname: 'vcf-ops-02.corp.local', authType: 'BEARER_TOKEN' }
      ];
    }

    for (const instance of instances) {
      await this.pollInstance(instance);
    }

    await this.rollupAggregator.compute5MinRollups();
  }

  private async pollInstance(instance: VcfInstanceConfig): Promise<void> {
    const cb = this.circuitBreakerMap.get(instance.id) || { consecutiveFailures: 0, isOpen: false };
    if (cb.isOpen) {
      console.warn(`[Scheduler] Circuit breaker OPEN for instance ${instance.name}. Skipping cycle.`);
      return;
    }

    try {
      const client = new VcfOpsApiClient(instance);
      const metricsWatermark = await this.watermarkMgr.getLastWatermark(instance.id, 'METRICS');

      const objects = await client.fetchObjects();
      const metrics = await client.fetchMetricsDelta(metricsWatermark);
      const alerts = await client.fetchAlertsDelta(metricsWatermark);

      const db = getDatabase();

      const resStmt = db.prepare('INSERT OR REPLACE INTO resources (instance_id, resource_uuid, resource_name, resource_kind, adapter_kind, last_seen) VALUES (?, ?, ?, ?, ?, ?)');
      for (const obj of objects) {
        resStmt.run(instance.id, obj.uuid, obj.name, obj.kind, obj.adapterKind, Date.now());
      }

      const metricStmt = db.prepare('INSERT OR IGNORE INTO raw_metrics (instance_id, resource_uuid, stat_key, timestamp, stat_value) VALUES (?, ?, ?, ?, ?)');
      let maxTimestamp = metricsWatermark;

      for (const m of metrics) {
        metricStmt.run(m.instanceId, m.resourceUuid, m.statKey, m.timestamp, m.statValue);
        if (m.timestamp > maxTimestamp) maxTimestamp = m.timestamp;
      }

      const alertStmt = db.prepare('INSERT OR REPLACE INTO alerts (alert_id, instance_id, resource_uuid, resource_name, alert_name, severity, status, start_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const a of alerts) {
        alertStmt.run(a.alertId, a.instanceId, a.resourceUuid, a.resourceName, a.alertName, a.severity, a.status, a.startTime, a.updateTime);
      }

      await this.watermarkMgr.updateWatermark(instance.id, 'METRICS', maxTimestamp);
      this.circuitBreakerMap.set(instance.id, { consecutiveFailures: 0, isOpen: false });

    } catch (err) {
      console.error(`[Scheduler] Error polling instance ${instance.name}:`, err);
      cb.consecutiveFailures += 1;
      if (cb.consecutiveFailures >= 3) {
        cb.isOpen = true;
      }
      this.circuitBreakerMap.set(instance.id, cb);
    }
  }
}
