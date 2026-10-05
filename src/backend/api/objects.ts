import express from 'express';
import { getDatabase } from '../db/database.ts';
import { readPreferences } from './users.ts';
import { loadMetricsConfig } from '../ingestion/collectionRules.ts';

const router = express.Router();

const RESOURCE_COLUMNS = `
  r.resource_uuid as resourceUuid, r.resource_name as resourceName, r.resource_kind as resourceKind,
  r.adapter_kind as adapterKind, r.instance_id as instanceId, r.last_seen as lastSeen,
  i.name as instanceName, i.hostname as instanceHostname
`;

function findResource(resourceUuid: string, instanceId?: string): any {
  const params: any[] = [resourceUuid];
  let sql = `SELECT ${RESOURCE_COLUMNS} FROM resources r LEFT JOIN vcf_instances i ON i.id = r.instance_id WHERE r.resource_uuid = ?`;
  if (instanceId) {
    sql += ' AND r.instance_id = ?';
    params.push(instanceId);
  }
  return getDatabase().prepare(sql).get(...params);
}

// Most recent sample of every stat key collected for a resource.
function latestMetrics(instanceId: string, resourceUuid: string): Array<{ statKey: string; value: number; timestamp: number }> {
  return getDatabase().prepare(`
    SELECT m.stat_key as statKey, m.stat_value as value, m.timestamp
    FROM raw_metrics m
    JOIN (
      SELECT stat_key, max(timestamp) as ts FROM raw_metrics
      WHERE instance_id = ? AND resource_uuid = ? GROUP BY stat_key
    ) latest ON latest.stat_key = m.stat_key AND latest.ts = m.timestamp
    WHERE m.instance_id = ? AND m.resource_uuid = ?
    GROUP BY m.stat_key ORDER BY m.stat_key ASC
  `).all(instanceId, resourceUuid, instanceId, resourceUuid) || [];
}

// Collected properties in the order (and with the display names) defined in metrics_list.yaml.
function resourceProperties(instanceId: string, resourceUuid: string, resourceKind: string): Array<{ key: string; name: string; value: string }> {
  const rows = getDatabase()
    .prepare('SELECT property_key as key, property_value as value FROM resource_properties WHERE instance_id = ? AND resource_uuid = ?')
    .all(instanceId, resourceUuid) || [];
  const valueByKey = new Map<string, string>(rows.map((r: any) => [r.key, r.value]));

  const rules = loadMetricsConfig().object_types[resourceKind]?.properties || [];
  return rules
    .filter(rule => valueByKey.has(rule.key))
    .map(rule => ({ key: rule.key, name: rule.name, value: valueByKey.get(rule.key)! }));
}

const HIERARCHY_LEVELS = [
  { kind: 'VMwareAdapter Instance', label: 'vCenter' },
  { kind: 'Datacenter', label: 'Datacenter' },
  { kind: 'ClusterComputeResource', label: 'Cluster' },
  { kind: 'HostSystem', label: 'ESXi Host' },
  { kind: 'Datastore', label: 'Datastore' }
];

// Related objects from the source inventory, top of the hierarchy first. "tracked" marks
// objects that are in this application's catalogue and can therefore be opened.
function resourceHierarchy(instanceId: string, resourceUuid: string): Array<{ label: string; kind: string; uuid: string; name: string; tracked: boolean }> {
  const rows = getDatabase().prepare(`
    SELECT rel.related_uuid as uuid, rel.related_name as name, rel.related_kind as kind,
           CASE WHEN r.resource_uuid IS NULL THEN 0 ELSE 1 END as tracked
    FROM resource_relations rel
    LEFT JOIN resources r ON r.instance_id = rel.instance_id AND r.resource_uuid = rel.related_uuid
    WHERE rel.instance_id = ? AND rel.resource_uuid = ?
    ORDER BY rel.related_name ASC
  `).all(instanceId, resourceUuid) || [];

  const hierarchy = [];
  for (const level of HIERARCHY_LEVELS) {
    for (const row of rows.filter((r: any) => r.kind === level.kind)) {
      hierarchy.push({ label: level.label, kind: row.kind, uuid: row.uuid, name: row.name, tracked: Boolean(row.tracked) });
    }
  }
  return hierarchy;
}

function activeAlertCount(instanceId: string, resourceUuid: string): number {
  const row = getDatabase()
    .prepare("SELECT count(*) as count FROM alerts WHERE instance_id = ? AND resource_uuid = ? AND status = 'ACTIVE'")
    .get(instanceId, resourceUuid);
  return Number(row?.count || 0);
}

// GET /api/v1/objects/summary - tracked object counts
router.get('/summary', (req, res) => {
  try {
    const params: any[] = [];
    let sql = 'SELECT resource_kind as kind, count(*) as count FROM resources';
    if (req.query.instanceId && req.query.instanceId !== 'ALL') {
      sql += ' WHERE instance_id = ?';
      params.push(String(req.query.instanceId));
    }
    const rows = getDatabase().prepare(`${sql} GROUP BY resource_kind`).all(...params) || [];

    const byKind: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byKind[r.kind] = Number(r.count);
      total += Number(r.count);
    }
    return res.json({ total, byKind });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/objects/pinned - the user's pinned objects with their latest collected values
router.get('/pinned', (req, res) => {
  try {
    const pinned = [];
    for (const ref of readPreferences().pinnedObjects) {
      const resource = findResource(ref.resourceUuid, ref.instanceId);
      if (!resource) continue;
      pinned.push({
        ...resource,
        latestMetrics: latestMetrics(resource.instanceId, resource.resourceUuid),
        activeAlerts: activeAlertCount(resource.instanceId, resource.resourceUuid)
      });
    }
    return res.json(pinned);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/objects/tree - instances -> resource kinds -> resources
router.get('/tree', (req, res) => {
  try {
    const db = getDatabase();
    const instances = db.prepare('SELECT id, name FROM vcf_instances ORDER BY name ASC').all() || [];
    const resources = db.prepare('SELECT resource_uuid, resource_name, resource_kind, instance_id FROM resources ORDER BY resource_name ASC').all() || [];

    const tree = instances
      .filter((inst: any) => !req.query.instanceId || req.query.instanceId === 'ALL' || req.query.instanceId === inst.id)
      .map((inst: any) => {
        const kinds = new Map<string, Array<{ id: string; name: string }>>();
        for (const r of resources) {
          if (r.instance_id !== inst.id) continue;
          if (!kinds.has(r.resource_kind)) kinds.set(r.resource_kind, []);
          kinds.get(r.resource_kind)!.push({ id: r.resource_uuid, name: r.resource_name });
        }
        return {
          id: inst.id,
          name: inst.name,
          kinds: Array.from(kinds.entries()).map(([kind, items]) => ({ kind, resources: items }))
        };
      });

    return res.json(tree);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/objects/:resourceUuid
router.get('/:resourceUuid', (req, res) => {
  try {
    const instanceId = req.query.instanceId && req.query.instanceId !== 'ALL' ? String(req.query.instanceId) : undefined;
    const resource = findResource(req.params.resourceUuid, instanceId);
    if (!resource) {
      return res.status(404).json({ error: `Resource ${req.params.resourceUuid} not found.` });
    }

    const pinned = readPreferences().pinnedObjects
      .some(p => p.instanceId === resource.instanceId && p.resourceUuid === resource.resourceUuid);

    return res.json({
      ...resource,
      pinned,
      properties: resourceProperties(resource.instanceId, resource.resourceUuid, resource.resourceKind),
      hierarchy: resourceHierarchy(resource.instanceId, resource.resourceUuid),
      latestMetrics: latestMetrics(resource.instanceId, resource.resourceUuid),
      activeAlerts: activeAlertCount(resource.instanceId, resource.resourceUuid)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
