import { getDatabase } from '../db/database.ts';

export default function metricRoutes(req: any, res: any, next: any) {
  const db = getDatabase();
  const url = req.url || '';

  // GET /api/v1/metrics/kpi
  if (url.includes('/kpi')) {
    try {
      const rows = db.prepare(`
        SELECT timestamp, stat_key, stat_value 
        FROM raw_metrics 
        ORDER BY timestamp ASC
      `).all() || [];

      const byTimestamp = new Map<number, any>();
      for (const r of rows) {
        let entry = byTimestamp.get(r.timestamp);
        if (!entry) {
          entry = {
            timestamp: r.timestamp,
            cpuUsage: 0,
            memUsage: 0,
            diskLatencyMs: 0,
            netThroughputKb: 12000
          };
          byTimestamp.set(r.timestamp, entry);
        }

        if (r.stat_key === 'cpu|usage_average') {
          entry.cpuUsage = Math.round(r.stat_value);
        } else if (r.stat_key === 'mem|usage_average') {
          entry.memUsage = Math.round(r.stat_value);
        } else if (r.stat_key === 'virtualDisk|totalLatency_average') {
          entry.diskLatencyMs = Math.round(r.stat_value);
        }
      }

      const result = Array.from(byTimestamp.values());
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/metrics/query or /api/v1/metrics
  try {
    const resourceUuid = req.query?.resourceUuid || req.query?.resourceId || 'vm-007';
    const statKeysParam = req.query?.statKeys || req.query?.statKey;
    const startTime = req.query?.startTime || req.query?.begin;
    const endTime = req.query?.endTime || req.query?.end;

    let sql = 'SELECT timestamp, stat_key, stat_value FROM raw_metrics WHERE 1=1';
    const params: any[] = [];

    if (resourceUuid && resourceUuid !== 'ALL') {
      sql += ' AND resource_uuid = ?';
      params.push(resourceUuid);
    }

    if (statKeysParam) {
      const keys = String(statKeysParam).split(',').map(k => k.trim()).filter(Boolean);
      if (keys.length > 0) {
        const placeholders = keys.map(() => '?').join(',');
        sql += ` AND stat_key IN (${placeholders})`;
        params.push(...keys);
      }
    }

    if (startTime) {
      sql += ' AND timestamp >= ?';
      params.push(Number(startTime));
    }
    if (endTime) {
      sql += ' AND timestamp <= ?';
      params.push(Number(endTime));
    }

    sql += ' ORDER BY timestamp ASC';

    const rows = db.prepare(sql).all(...params) || [];

    // Pivot rows by timestamp: { timestamp, [stat_key]: stat_value, ... }
    const pointsMap = new Map<number, Record<string, any>>();
    for (const r of rows) {
      let p = pointsMap.get(r.timestamp);
      if (!p) {
        p = { timestamp: r.timestamp };
        pointsMap.set(r.timestamp, p);
      }
      p[r.stat_key] = Math.round(r.stat_value * 10) / 10;
    }

    const points = Array.from(pointsMap.values());
    return res.json(points);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
