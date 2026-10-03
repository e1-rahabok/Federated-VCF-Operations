import path from 'node:path';

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'vcf_ops_jwt_secret_key_change_me_in_prod',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  RAW_METRICS_RETENTION_HOURS: process.env.RAW_METRICS_RETENTION_HOURS ? parseInt(process.env.RAW_METRICS_RETENTION_HOURS, 10) : 48,
  SUMMARY_METRICS_RETENTION_DAYS: process.env.SUMMARY_METRICS_RETENTION_DAYS ? parseInt(process.env.SUMMARY_METRICS_RETENTION_DAYS, 10) : 90,
  POLLING_INTERVAL_SECONDS: process.env.POLLING_INTERVAL_SECONDS ? parseInt(process.env.POLLING_INTERVAL_SECONDS, 10) : 60,
  DB_FILE: process.env.DATABASE_URL || path.join(process.cwd(), 'vcf_ops.db')
};
