import crypto from 'node:crypto';
import path from 'node:path';

// DATABASE_URL is documented as "file:./data/vcf_ops.db"; node:sqlite wants a plain path.
function resolveDbFile(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return path.join(process.cwd(), 'vcf_ops.db');
  return raw.startsWith('file:') ? raw.substring('file:'.length) : raw;
}

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Signs session tokens. Without JWT_SECRET a random key is generated at startup, which is
  // safe but means everyone must sign in again after a restart.
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  SESSION_HOURS: process.env.SESSION_HOURS ? parseInt(process.env.SESSION_HOURS, 10) : 8,
  // First administrator, created only when no user exists yet. With no ADMIN_PASSWORD a
  // random password is generated and printed once to the server log.
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  RAW_METRICS_RETENTION_HOURS: process.env.RAW_METRICS_RETENTION_HOURS ? parseInt(process.env.RAW_METRICS_RETENTION_HOURS, 10) : 48,
  SUMMARY_METRICS_RETENTION_DAYS: process.env.SUMMARY_METRICS_RETENTION_DAYS ? parseInt(process.env.SUMMARY_METRICS_RETENTION_DAYS, 10) : 90,
  POLLING_INTERVAL_SECONDS: process.env.POLLING_INTERVAL_SECONDS ? parseInt(process.env.POLLING_INTERVAL_SECONDS, 10) : 60,
  API_TIMEOUT_SECONDS: process.env.API_TIMEOUT_SECONDS ? parseInt(process.env.API_TIMEOUT_SECONDS, 10) : 15,
  DB_FILE: resolveDbFile(),
  CONFIG_DIR: process.env.CONFIG_DIR || path.join(process.cwd(), 'Configuration'),
  FRONTEND_DIST: process.env.FRONTEND_DIST || path.join(process.cwd(), 'dist', 'frontend'),
  // Lab/test escape hatch: lets an instance hostname be given as "http://host:port".
  // Without it every VCF Operations call is HTTPS (REQ-TEC-006).
  ALLOW_INSECURE_HTTP: process.env.ALLOW_INSECURE_HTTP === 'true',
  // Demo dataset is opt-in; by default the database only holds what was ingested.
  SEED_DEMO_DATA: process.env.SEED_DEMO_DATA === 'true'
};
