import express from 'express';
import { getDatabase } from '../db/database.ts';

const router = express.Router();

const ALERT_COLUMNS = `
  a.alert_id as alertId, a.instance_id as instanceId, a.resource_uuid as resourceUuid,
  COALESCE(a.resource_name, r.resource_name, a.resource_uuid) as resourceName,
  r.resource_kind as resourceKind, r.adapter_kind as adapterKind,
  a.alert_name as alertName, a.severity, a.status,
  a.start_time as startTime, a.update_time as updateTime, a.cancel_time as cancelTime
`;
const ALERT_FROM = `
  FROM alerts a
  LEFT JOIN resources r ON r.instance_id = a.instance_id AND r.resource_uuid = a.resource_uuid
`;

function instanceFilter(query: any, column: string, params: any[]): string {
  if (query.instanceId && query.instanceId !== 'ALL') {
    params.push(query.instanceId);
    return ` AND ${column} = ?`;
  }
  return '';
}

// GET /api/v1/alerts/summary - active alert counts per severity
router.get('/summary', (req, res) => {
  try {
    const params: any[] = [];
    const sql = `SELECT severity, count(*) as count FROM alerts WHERE status = 'ACTIVE'${instanceFilter(req.query, 'instance_id', params)} GROUP BY severity`;
    const rows = getDatabase().prepare(sql).all(...params) || [];

    const summary: Record<string, number> = { critical: 0, immediate: 0, warning: 0, info: 0 };
    for (const r of rows) {
      summary[(r.severity || '').toLowerCase()] = Number(r.count);
    }
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/alerts/timeline?startTime=&endTime=&buckets= - alerts started per time bucket
router.get('/timeline', (req, res) => {
  try {
    const endTime = req.query.endTime ? Number(req.query.endTime) : Date.now();
    const startTime = req.query.startTime ? Number(req.query.startTime) : endTime - 6 * 60 * 60 * 1000;
    const bucketCount = Math.min(48, Math.max(1, Number(req.query.buckets) || 12));
    const bucketSizeMs = Math.max(1, Math.ceil((endTime - startTime) / bucketCount));

    const params: any[] = [startTime, endTime];
    const sql = `SELECT start_time as startTime, severity FROM alerts WHERE start_time >= ? AND start_time <= ?${instanceFilter(req.query, 'instance_id', params)}`;
    const alerts = getDatabase().prepare(sql).all(...params) || [];

    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      timestamp: startTime + i * bucketSizeMs,
      critical: 0, immediate: 0, warning: 0, info: 0, total: 0
    }));
    for (const a of alerts) {
      const bucket = buckets[Math.min(bucketCount - 1, Math.floor((a.startTime - startTime) / bucketSizeMs))];
      const sev = (a.severity || '').toLowerCase();
      if (sev in bucket) (bucket as any)[sev] += 1;
      bucket.total += 1;
    }
    return res.json(buckets);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/alerts/:alertId
router.get('/:alertId', (req, res) => {
  try {
    const alert = getDatabase().prepare(`
      SELECT ${ALERT_COLUMNS}, i.name as instanceName, i.hostname as instanceHostname
      ${ALERT_FROM}
      LEFT JOIN vcf_instances i ON i.id = a.instance_id
      WHERE a.alert_id = ?
    `).get(req.params.alertId);

    if (!alert) {
      return res.status(404).json({ error: `Alert ${req.params.alertId} not found in database.` });
    }
    const conditions = getDatabase().prepare(`
      SELECT stat_key as statKey, operator, threshold, severity
      FROM alert_conditions WHERE instance_id = ? AND alert_id = ?
      ORDER BY stat_key ASC
    `).all(alert.instanceId, alert.alertId) || [];

    return res.json({ ...alert, conditions });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/alerts (Query list from SQLite)
router.get('/', (req, res) => {
  try {
    const { severity, status, search, resourceUuid, startTime } = req.query as Record<string, string>;
    const params: any[] = [];
    let sql = `SELECT ${ALERT_COLUMNS} ${ALERT_FROM} WHERE 1=1`;

    if (severity && severity !== 'ALL') {
      sql += ' AND a.severity = ?';
      params.push(severity);
    }
    if (status && status !== 'ALL') {
      sql += ' AND a.status = ?';
      params.push(status);
    }
    sql += instanceFilter(req.query, 'a.instance_id', params);
    if (resourceUuid) {
      sql += ' AND a.resource_uuid = ?';
      params.push(resourceUuid);
    }
    if (startTime) {
      sql += ' AND a.start_time >= ?';
      params.push(Number(startTime));
    }
    if (search) {
      sql += ' AND (LOWER(a.alert_name) LIKE ? OR LOWER(COALESCE(a.resource_name, r.resource_name, a.resource_uuid)) LIKE ?)';
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    sql += ' ORDER BY a.start_time DESC';
    return res.json(getDatabase().prepare(sql).all(...params));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
