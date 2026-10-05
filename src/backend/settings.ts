import { CONFIG } from './config.ts';
import { getDatabase } from './db/database.ts';

export interface RetentionSettings {
  rawHours: number;
  summaryDays: number;
}

// Allowed ranges from REQ-TEC-016 / REQ-TEC-017.
export const RETENTION_LIMITS = {
  rawHours: { min: 12, max: 168 },
  summaryDays: { min: 30, max: 365 }
};

function readNumber(key: string, fallback: number): number {
  const row = getDatabase().prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  const value = row ? Number(row.value) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

/** Retention saved from the Settings page, falling back to the environment defaults. */
export function getRetention(): RetentionSettings {
  return {
    rawHours: readNumber('retention_raw_hours', CONFIG.RAW_METRICS_RETENTION_HOURS),
    summaryDays: readNumber('retention_summary_days', CONFIG.SUMMARY_METRICS_RETENTION_DAYS)
  };
}

/** Validates and stores retention. Throws an Error describing the first invalid value. */
export function saveRetention(input: any): RetentionSettings {
  const next: RetentionSettings = { rawHours: Number(input?.rawHours), summaryDays: Number(input?.summaryDays) };

  for (const field of ['rawHours', 'summaryDays'] as const) {
    const { min, max } = RETENTION_LIMITS[field];
    if (!Number.isInteger(next[field]) || next[field] < min || next[field] > max) {
      throw new Error(`${field} must be a whole number between ${min} and ${max}.`);
    }
  }

  const upsert = getDatabase().prepare(`
    INSERT INTO system_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  upsert.run('retention_raw_hours', String(next.rawHours));
  upsert.run('retention_summary_days', String(next.summaryDays));
  return next;
}
