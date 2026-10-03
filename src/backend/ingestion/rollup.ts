import { getDatabase } from '../db/database.ts';

export class RollupAggregator {
  public async compute5MinRollups(): Promise<number> {
    const db = getDatabase();
    const now = Date.now();
    const fiveMinsAgo = now - 5 * 60 * 1000;

    try {
      const stmt = db.prepare(`
        SELECT instance_id, resource_uuid, stat_key,
               MIN(stat_value) as val_min,
               MAX(stat_value) as val_max,
               AVG(stat_value) as val_avg,
               COUNT(stat_value) as sample_count
        FROM raw_metrics
        WHERE timestamp >= ?
        GROUP BY instance_id, resource_uuid, stat_key
      `);

      const rows = stmt.all(fiveMinsAgo) || [];
      const insertStmt = db.prepare(`
        INSERT INTO summary_metrics (instance_id, resource_uuid, stat_key, time_bucket, granularity, val_min, val_max, val_avg, val_p95, sample_count)
        VALUES (?, ?, ?, ?, '5MIN', ?, ?, ?, ?, ?)
      `);

      let count = 0;
      for (const row of rows) {
        const valP95 = row.val_avg + (row.val_max - row.val_avg) * 0.85;
        insertStmt.run(row.instance_id, row.resource_uuid, row.stat_key, fiveMinsAgo, row.val_min, row.val_max, row.val_avg, valP95, row.sample_count);
        count++;
      }
      return count;
    } catch (err) {
      return 0;
    }
  }

  public async purgeExpiredRawMetrics(retentionHours: number = 48): Promise<number> {
    const db = getDatabase();
    const purgeThreshold = Date.now() - retentionHours * 60 * 60 * 1000;
    try {
      const stmt = db.prepare('DELETE FROM raw_metrics WHERE timestamp < ?');
      const result = stmt.run(purgeThreshold);
      return result.changes || 0;
    } catch (err) {
      return 0;
    }
  }
}
