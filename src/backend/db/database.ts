import { CONFIG } from '../config.ts';

let sqliteDb: any = null;

export function getDatabase() {
  if (sqliteDb) return sqliteDb;

  try {
    const { DatabaseSync } = require('node:sqlite');
    sqliteDb = new DatabaseSync(CONFIG.DB_FILE);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA busy_timeout = 5000;');
  } catch (err) {
    sqliteDb = createFallbackDb();
  }

  initSchema(sqliteDb);
  return sqliteDb;
}

function initSchema(db: any) {
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS vcf_instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      username TEXT,
      password_encrypted TEXT,
      vidb_host TEXT,
      client_id TEXT,
      refresh_token_encrypted TEXT,
      enabled INTEGER DEFAULT 1,
      status TEXT DEFAULT 'HEALTHY',
      last_poll INTEGER
    );

    CREATE TABLE IF NOT EXISTS resources (
      instance_id TEXT NOT NULL,
      resource_uuid TEXT NOT NULL,
      resource_name TEXT NOT NULL,
      resource_kind TEXT NOT NULL,
      adapter_kind TEXT,
      last_seen INTEGER,
      PRIMARY KEY (instance_id, resource_uuid)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      alert_id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      resource_uuid TEXT NOT NULL,
      resource_name TEXT,
      alert_name TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      update_time INTEGER,
      cancel_time INTEGER
    );

    CREATE TABLE IF NOT EXISTS raw_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      resource_uuid TEXT NOT NULL,
      stat_key TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      stat_value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS summary_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instance_id TEXT NOT NULL,
      resource_uuid TEXT NOT NULL,
      stat_key TEXT NOT NULL,
      time_bucket INTEGER NOT NULL,
      granularity TEXT NOT NULL,
      val_min REAL,
      val_max REAL,
      val_avg REAL,
      val_p95 REAL,
      sample_count INTEGER
    );

    CREATE TABLE IF NOT EXISTS watermarks (
      instance_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      last_polled_timestamp INTEGER NOT NULL,
      PRIMARY KEY (instance_id, data_type)
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      username TEXT PRIMARY KEY,
      layout_json TEXT NOT NULL
    );
  `;

  if (typeof db.exec === 'function') {
    db.exec(schemaSql);
  }
}

function createFallbackDb() {
  return {
    exec: (sql: string) => {},
    prepare: (sql: string) => {
      return {
        run: (...args: any[]) => ({ lastInsertRowid: 1, changes: 1 }),
        get: (...args: any[]) => undefined,
        all: (...args: any[]) => []
      };
    }
  };
}
