import { getDatabase } from '../db/database.ts';

export interface Watermark {
  instanceId: string;
  dataType: 'METRICS' | 'ALERTS';
  lastPolledTimestamp: number;
}

export class WatermarkManager {
  public async getLastWatermark(instanceId: string, dataType: 'METRICS' | 'ALERTS'): Promise<number> {
    const db = getDatabase();
    try {
      const stmt = db.prepare('SELECT last_polled_timestamp FROM watermarks WHERE instance_id = ? AND data_type = ?');
      const row = stmt.get(instanceId, dataType);
      if (row && row.last_polled_timestamp) {
        return row.last_polled_timestamp;
      }
    } catch (err) {
      // Fallback
    }
    return Date.now() - (2 * 60 * 1000);
  }

  public async updateWatermark(instanceId: string, dataType: 'METRICS' | 'ALERTS', timestamp: number): Promise<void> {
    const db = getDatabase();
    try {
      const stmt = db.prepare(`
        INSERT INTO watermarks (instance_id, data_type, last_polled_timestamp)
        VALUES (?, ?, ?)
        ON CONFLICT(instance_id, data_type) DO UPDATE SET last_polled_timestamp = excluded.last_polled_timestamp
      `);
      stmt.run(instanceId, dataType, timestamp);
    } catch (err) {
      // Fallback
    }
  }
}
