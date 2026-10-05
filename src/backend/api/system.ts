import express from 'express';
import fs from 'node:fs';
import { CONFIG } from '../config.ts';
import { getDatabase } from '../db/database.ts';
import { ALERTS_CONFIG_PATH, METRICS_CONFIG_PATH } from '../ingestion/collectionRules.ts';
import { parseYamlConfig } from '../../shared/telemetryConfig.ts';
import { RETENTION_LIMITS, getRetention, saveRetention } from '../settings.ts';

const router = express.Router();

const CONFIG_FILES: Record<string, { path: string; label: string }> = {
  metrics: { path: METRICS_CONFIG_PATH, label: 'Metrics' },
  alerts: { path: ALERTS_CONFIG_PATH, label: 'Alert' }
};

// GET /api/v1/system/status - ingestion and storage figures read from SQLite
router.get('/status', (req, res) => {
  try {
    const db = getDatabase();
    const count = (sql: string, ...params: any[]) => Number(db.prepare(sql).get(...params)?.count || 0);
    const instances = db.prepare('SELECT status, enabled, last_poll as lastPoll FROM vcf_instances').all() || [];
    const lastPoll = instances.reduce((max: number, i: any) => Math.max(max, i.lastPoll || 0), 0);

    return res.json({
      pollingIntervalSeconds: CONFIG.POLLING_INTERVAL_SECONDS,
      lastPoll: lastPoll || null,
      instances: {
        total: instances.length,
        enabled: instances.filter((i: any) => i.enabled).length,
        healthy: instances.filter((i: any) => i.enabled && i.status === 'HEALTHY').length
      },
      objects: count('SELECT count(*) as count FROM resources'),
      rawSamples: count('SELECT count(*) as count FROM raw_metrics'),
      samplesLast5Min: count('SELECT count(*) as count FROM raw_metrics WHERE timestamp >= ?', Date.now() - 5 * 60 * 1000),
      summaryRows: count('SELECT count(*) as count FROM summary_metrics'),
      retention: getRetention(),
      retentionLimits: RETENTION_LIMITS
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT /api/v1/system/settings/retention - { rawHours, summaryDays }; applied by the next purge
router.put('/settings/retention', (req, res) => {
  try {
    return res.json({ success: true, retention: saveRetention(req.body) });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/v1/system/config/metrics | /alerts
router.get('/config/:type', (req, res) => {
  const file = CONFIG_FILES[req.params.type];
  if (!file) return res.status(404).json({ error: 'Config route not found' });

  try {
    const content = fs.readFileSync(file.path, 'utf-8');
    return res.json({ success: true, yaml: content, config: parseYamlConfig(content) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/system/config/metrics | /alerts
router.put('/config/:type', (req, res) => {
  const file = CONFIG_FILES[req.params.type];
  if (!file) return res.status(404).json({ error: 'Config route not found' });

  try {
    const { yaml } = req.body || {};
    if (!yaml) {
      return res.status(400).json({ success: false, error: 'YAML content is required.' });
    }
    fs.writeFileSync(file.path, yaml, 'utf-8');
    console.log(`[SystemConfig] Updated ${file.path}.`);
    return res.json({ success: true, message: `${file.label} collection configuration saved. It applies from the next polling cycle.`, config: parseYamlConfig(yaml) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
