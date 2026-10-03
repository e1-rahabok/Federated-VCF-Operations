import { getDatabase } from '../db/database.ts';

export default function alertRoutes(req: any, res: any, next: any) {
  const db = getDatabase();
  const url = req.url || '';

  // GET /api/v1/alerts/summary
  if (url.includes('/summary')) {
    try {
      const rows = db.prepare("SELECT severity, count(*) as count FROM alerts WHERE status = 'ACTIVE' GROUP BY severity").all() || [];
      const summary: Record<string, number> = { critical: 0, immediate: 0, warning: 0, info: 0 };
      for (const r of rows) {
        const sev = (r.severity || '').toLowerCase();
        if (summary[sev] !== undefined) {
          summary[sev] = Number(r.count);
        } else {
          summary[sev] = Number(r.count);
        }
      }
      return res.json(summary);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/alerts/timeline
  if (url.includes('/timeline')) {
    try {
      const alerts = db.prepare('SELECT start_time as startTime, severity FROM alerts ORDER BY start_time ASC').all() || [];
      const now = Date.now();
      const bucketSizeMs = 60 * 60 * 1000; // 1 hour buckets for last 6 hours
      const buckets: any[] = [];

      for (let i = 5; i >= 0; i--) {
        const bStart = now - (i + 1) * bucketSizeMs;
        const bEnd = now - i * bucketSizeMs;
        const inBucket = alerts.filter((a: any) => a.startTime >= bStart && a.startTime < bEnd);
        buckets.push({
          timestamp: bEnd,
          critical: inBucket.filter((a: any) => a.severity === 'CRITICAL').length,
          warning: inBucket.filter((a: any) => a.severity === 'WARNING').length,
          info: inBucket.filter((a: any) => a.severity === 'INFO').length,
          total: inBucket.length
        });
      }
      return res.json(buckets);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/alerts/:alertId
  const alertId = req.params?.alertId;
  if (alertId && alertId !== 'summary' && alertId !== 'timeline') {
    try {
      const alert = db.prepare(`
        SELECT alert_id as alertId, instance_id as instanceId, resource_uuid as resourceUuid, 
               resource_name as resourceName, alert_name as alertName, severity, status, 
               start_time as startTime, update_time as updateTime 
        FROM alerts 
        WHERE alert_id = ?
      `).get(alertId);

      if (!alert) {
        return res.status(404).json({ error: `Alert ${alertId} not found in database.` });
      }

      const resource = db.prepare('SELECT * FROM resources WHERE resource_uuid = ?').get(alert.resourceUuid);

      return res.json({
        ...alert,
        resourceContext: {
          resourceUuid: alert.resourceUuid,
          resourceName: alert.resourceName,
          resourceKind: resource?.resource_kind || 'VirtualMachine',
          hostSystem: 'esx-01.corp.local',
          vcfInstance: alert.instanceId,
          vcfHostname: `${alert.instanceId.toLowerCase()}.corp.local`
        },
        triggeringStatKey: 'cpu|ready_summation'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/alerts (Query list from SQLite)
  try {
    const { severity, instanceId, search } = req.query || {};
    let sql = `
      SELECT alert_id as alertId, instance_id as instanceId, resource_uuid as resourceUuid, 
             resource_name as resourceName, alert_name as alertName, severity, status, 
             start_time as startTime, update_time as updateTime 
      FROM alerts 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (severity && severity !== 'ALL') {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (instanceId && instanceId !== 'ALL') {
      sql += ' AND instance_id = ?';
      params.push(instanceId);
    }
    if (search) {
      sql += ' AND (LOWER(alert_name) LIKE ? OR LOWER(resource_name) LIKE ?)';
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }

    sql += ' ORDER BY start_time DESC';
    const alerts = db.prepare(sql).all(...params);
    return res.json(alerts);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
