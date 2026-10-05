import express from 'express';
import { getDatabase } from '../db/database.ts';
import { findMetricRule, loadMetricsConfig } from '../ingestion/collectionRules.ts';
import { findInstance, getClient } from '../ingestion/clientRegistry.ts';

const router = express.Router();

const RESOLUTION_MS: Record<string, number> = {
  '5m': 5 * 60 * 1000,
  '1h': 60 * 60 * 1000
};

function resourceFilter(query: any, params: any[]): string {
  let sql = ' AND resource_uuid = ?';
  params.push(String(query.resourceUuid));
  if (query.instanceId && query.instanceId !== 'ALL') {
    sql += ' AND instance_id = ?';
    params.push(String(query.instanceId));
  }
  return sql;
}

// GET /api/v1/metrics/keys?resourceUuid= - stat keys that have samples for a resource
router.get('/keys', (req, res) => {
  try {
    if (!req.query.resourceUuid) {
      return res.status(400).json({ error: 'resourceUuid is required.' });
    }
    const db = getDatabase();
    const params: any[] = [];
    const rows = db.prepare(`
      SELECT stat_key as statKey, count(*) as sampleCount, max(timestamp) as lastTimestamp
      FROM raw_metrics WHERE 1=1${resourceFilter(req.query, params)}
      GROUP BY stat_key ORDER BY stat_key ASC
    `).all(...params) || [];

    const resource = db.prepare('SELECT resource_kind FROM resources WHERE resource_uuid = ?').get(String(req.query.resourceUuid));
    const config = loadMetricsConfig();

    return res.json(rows.map((r: any) => {
      const rule = resource ? findMetricRule(config, resource.resource_kind, r.statKey) : undefined;
      return { ...r, name: rule?.name || r.statKey, unit: rule?.unit || '' };
    }));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/metrics/top?kind=&statKey=&limit=&instanceId=
// Resources of one kind ranked by their most recent sample of a stat key.
router.get('/top', (req, res) => {
  try {
    const kind = String(req.query.kind || '');
    const statKey = String(req.query.statKey || '');
    if (!kind || !statKey) {
      return res.status(400).json({ error: 'kind and statKey are required.' });
    }
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const params: any[] = [statKey, kind];
    let instanceSql = '';
    if (req.query.instanceId && req.query.instanceId !== 'ALL') {
      instanceSql = ' AND r.instance_id = ?';
      params.push(String(req.query.instanceId));
    }
    params.push(limit);

    const rows = getDatabase().prepare(`
      SELECT r.resource_uuid as resourceUuid, r.resource_name as resourceName, r.instance_id as instanceId,
             m.stat_value as value, m.timestamp
      FROM resources r
      JOIN raw_metrics m ON m.instance_id = r.instance_id AND m.resource_uuid = r.resource_uuid AND m.stat_key = ?
      WHERE r.resource_kind = ?${instanceSql}
        AND m.timestamp = (
          SELECT max(m2.timestamp) FROM raw_metrics m2
          WHERE m2.instance_id = m.instance_id AND m2.resource_uuid = m.resource_uuid AND m2.stat_key = m.stat_key
        )
      GROUP BY r.instance_id, r.resource_uuid
      ORDER BY m.stat_value DESC
      LIMIT ?
    `).all(...params) || [];

    const rule = findMetricRule(loadMetricsConfig(), kind, statKey);
    return res.json({ kind, statKey, name: rule?.name || statKey, unit: rule?.unit || '', collected: Boolean(rule?.active), resources: rows });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/metrics/live?instanceId=&resourceUuid=&statKeys=a,b&startTime=&endTime=
// Reads samples straight from the source VCF Operations instance (nothing is stored). Used for
// stat keys that are not in metrics_list.yaml, such as the metric that triggered an alert.
router.get('/live', async (req, res) => {
  try {
    const { instanceId, resourceUuid } = req.query as Record<string, string>;
    const keys = String(req.query.statKeys || '').split(',').map(k => k.trim()).filter(Boolean);
    if (!instanceId || !resourceUuid || keys.length === 0) {
      return res.status(400).json({ error: 'instanceId, resourceUuid and statKeys are required.' });
    }
    const instance = findInstance(instanceId);
    if (!instance) {
      return res.status(404).json({ error: `Instance ${instanceId} not found.` });
    }

    const endTime = req.query.endTime ? Number(req.query.endTime) : Date.now();
    const startTime = req.query.startTime ? Number(req.query.startTime) : endTime - 60 * 60 * 1000;
    const samples = await getClient(instance).fetchMetricsDelta([resourceUuid], keys, startTime, endTime);

    const pointsMap = new Map<number, Record<string, any>>();
    for (const s of samples) {
      let p = pointsMap.get(s.timestamp);
      if (!p) {
        p = { timestamp: s.timestamp };
        pointsMap.set(s.timestamp, p);
      }
      p[s.statKey] = s.statValue;
    }
    return res.json(Array.from(pointsMap.values()).sort((a, b) => a.timestamp - b.timestamp));
  } catch (err: any) {
    return res.status(502).json({ error: `Could not read from the source instance: ${err.message}` });
  }
});

// GET /api/v1/metrics/query?resourceUuid=&statKeys=a,b&resolution=1m|5m|1h&startTime=&endTime=
// Returns points pivoted by timestamp: { timestamp, [statKey]: value, ... }
router.get('/query', (req, res) => {
  try {
    if (!req.query.resourceUuid) {
      return res.status(400).json({ error: 'resourceUuid is required.' });
    }
    const resolution = String(req.query.resolution || '1m');
    if (resolution !== '1m' && !RESOLUTION_MS[resolution]) {
      return res.status(400).json({ error: `Unsupported resolution '${resolution}'. Use 1m, 5m or 1h.` });
    }

    const params: any[] = [];
    let where = ` WHERE 1=1${resourceFilter(req.query, params)}`;

    const keys = String(req.query.statKeys || '').split(',').map(k => k.trim()).filter(Boolean);
    if (keys.length > 0) {
      where += ` AND stat_key IN (${keys.map(() => '?').join(',')})`;
      params.push(...keys);
    }
    if (req.query.startTime) {
      where += ' AND timestamp >= ?';
      params.push(Number(req.query.startTime));
    }
    if (req.query.endTime) {
      where += ' AND timestamp <= ?';
      params.push(Number(req.query.endTime));
    }

    // 5m / 1h series are averaged per aligned time bucket straight from the stored samples.
    const bucketMs = RESOLUTION_MS[resolution];
    const sql = bucketMs
      ? `SELECT (timestamp / ${bucketMs}) * ${bucketMs} as timestamp, stat_key, AVG(stat_value) as stat_value
         FROM raw_metrics${where} GROUP BY 1, stat_key ORDER BY 1 ASC`
      : `SELECT timestamp, stat_key, stat_value FROM raw_metrics${where} ORDER BY timestamp ASC`;

    const rows = getDatabase().prepare(sql).all(...params) || [];

    const pointsMap = new Map<number, Record<string, any>>();
    for (const r of rows) {
      let p = pointsMap.get(r.timestamp);
      if (!p) {
        p = { timestamp: r.timestamp };
        pointsMap.set(r.timestamp, p);
      }
      p[r.stat_key] = r.stat_value;
    }

    return res.json(Array.from(pointsMap.values()));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
