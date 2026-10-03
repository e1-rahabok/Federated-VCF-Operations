import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.ts';

let sqliteDb: any = null;

export function getDatabase() {
  if (sqliteDb) return sqliteDb;

  try {
    const dbDir = path.dirname(CONFIG.DB_FILE);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    sqliteDb = new DatabaseSync(CONFIG.DB_FILE);
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
    sqliteDb.exec('PRAGMA busy_timeout = 5000;');
  } catch (err: any) {
    console.error('[Database] Failed to open DatabaseSync, falling back to in-memory SQLite:', err);
    try {
      sqliteDb = new DatabaseSync(':memory:');
    } catch (e) {
      sqliteDb = createFallbackDb();
    }
  }

  initSchema(sqliteDb);
  seedInitialData(sqliteDb);
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

function seedInitialData(db: any) {
  try {
    const instCount = db.prepare('SELECT count(*) as count FROM vcf_instances').get();
    if (!instCount || instCount.count === 0) {
      console.log('[Database] Seeding initial VCF instances in SQLite...');
      const insertInst = db.prepare(`
        INSERT INTO vcf_instances (id, name, hostname, auth_type, username, enabled, status, last_poll)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertInst.run('vcf-ops-01', 'VCF-Ops-01', 'vcf-ops-01.corp.local', 'OPS_TOKEN', 'admin', 1, 'HEALTHY', Date.now() - 10000);
      insertInst.run('vcf-ops-02', 'VCF-Ops-02', 'vcf-ops-02.corp.local', 'BEARER_TOKEN', 'vidb-admin', 1, 'HEALTHY', Date.now() - 15000);
    }

    const resCount = db.prepare('SELECT count(*) as count FROM resources').get();
    if (!resCount || resCount.count === 0) {
      console.log('[Database] Seeding initial infrastructure resources in SQLite...');
      const insertRes = db.prepare(`
        INSERT INTO resources (instance_id, resource_uuid, resource_name, resource_kind, adapter_kind, last_seen)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertRes.run('vcf-ops-01', 'vm-007', 'VM-007 (SQL-Prod)', 'VirtualMachine', 'VMWARE', Date.now());
      insertRes.run('vcf-ops-01', 'vm-008', 'VM-008 (Web-App)', 'VirtualMachine', 'VMWARE', Date.now());
      insertRes.run('vcf-ops-01', 'esx-01', 'esx-01.corp.local', 'HostSystem', 'VMWARE', Date.now());
      insertRes.run('vcf-ops-01', 'cluster-01', 'Cluster-vSAN-01', 'ClusterComputeResource', 'VMWARE', Date.now());
      insertRes.run('vcf-ops-01', 'datastore-01', 'vsanDatastore', 'Datastore', 'VMWARE', Date.now());
    }

    const alertCount = db.prepare('SELECT count(*) as count FROM alerts').get();
    if (!alertCount || alertCount.count === 0) {
      console.log('[Database] Seeding initial active alerts in SQLite...');
      const insertAlert = db.prepare(`
        INSERT INTO alerts (alert_id, instance_id, resource_uuid, resource_name, alert_name, severity, status, start_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = Date.now();
      insertAlert.run('alt-98234-vcf', 'VCF-Ops-01', 'vm-007', 'VM-007 (SQL-Prod)', 'High CPU Ready Latency on Virtual Machine VM-007', 'WARNING', 'ACTIVE', now - 18 * 60 * 1000, now - 2 * 60 * 1000);
      insertAlert.run('alt-98235-vcf', 'VCF-Ops-02', 'esx-01', 'esx-01.corp.local', 'Physical Power Supply Unit Fault', 'CRITICAL', 'ACTIVE', now - 42 * 60 * 1000, now - 5 * 60 * 1000);
      insertAlert.run('alt-98236-vcf', 'VCF-Ops-01', 'datastore-01', 'vsanDatastore', 'Datastore Capacity Usage Exceeds 85% Warning', 'WARNING', 'ACTIVE', now - 95 * 60 * 1000, now - 10 * 60 * 1000);
      insertAlert.run('alt-98237-vcf', 'VCF-Ops-01', 'vm-008', 'VM-008 (Web-App)', 'Snapshot age exceeds 7 days', 'INFO', 'ACTIVE', now - 180 * 60 * 1000, now - 60 * 60 * 1000);
    }

    const metricsCount = db.prepare('SELECT count(*) as count FROM raw_metrics').get();
    if (!metricsCount || metricsCount.count === 0) {
      console.log('[Database] Seeding initial raw metrics timeseries in SQLite...');
      const insertMetric = db.prepare(`
        INSERT INTO raw_metrics (instance_id, resource_uuid, stat_key, timestamp, stat_value)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = Date.now();
      const step = 5 * 60 * 1000; // 5-minute intervals for 6 hours
      const count = 72; // 6 hours

      for (let i = count; i >= 0; i--) {
        const ts = now - i * step;
        // Deterministic realistic values
        const cpuVal = Math.round(55 + 25 * Math.sin(i / 6) + ((i % 5) - 2));
        const readyVal = Math.round(18 + 10 * Math.cos(i / 6) + ((i % 3) - 1));
        const memVal = Math.round(72 + 8 * Math.sin(i / 8));
        const latVal = +(2.5 + 1.2 * Math.sin(i / 4)).toFixed(2);

        insertMetric.run('vcf-ops-01', 'vm-007', 'cpu|usage_average', ts, Math.max(5, Math.min(100, cpuVal)));
        insertMetric.run('vcf-ops-01', 'vm-007', 'cpu|ready_summation', ts, Math.max(1, Math.min(45, readyVal)));
        insertMetric.run('vcf-ops-01', 'vm-007', 'mem|usage_average', ts, Math.max(10, Math.min(98, memVal)));
        insertMetric.run('vcf-ops-01', 'vm-007', 'virtualDisk|totalLatency_average', ts, latVal);
      }
    }
  } catch (err) {
    console.error('[Database] Error seeding initial data:', err);
  }
}

function createFallbackDb() {
  const store: Record<string, any[]> = {
    vcf_instances: [],
    resources: [],
    alerts: [],
    raw_metrics: []
  };

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
