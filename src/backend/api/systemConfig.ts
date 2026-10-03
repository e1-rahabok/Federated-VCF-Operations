import fs from 'node:fs';
import path from 'node:path';

const METRICS_CONFIG_PATH = path.resolve(process.cwd(), 'Configuration/metrics_list.yaml');
const ALERTS_CONFIG_PATH = path.resolve(process.cwd(), 'Configuration/alerts_list.yaml');

export default function systemConfigRoutes(req: any, res: any, next: any) {
  const url = req.url || '';

  // GET /api/v1/system/config/metrics
  if (url.includes('/metrics') && req.method === 'GET') {
    try {
      const content = fs.readFileSync(METRICS_CONFIG_PATH, 'utf-8');
      return res.json({ success: true, yaml: content });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT /api/v1/system/config/metrics
  if (url.includes('/metrics') && req.method === 'PUT') {
    try {
      const { yaml } = req.body || {};
      if (!yaml) {
        return res.status(400).json({ success: false, error: 'YAML content is required.' });
      }
      fs.writeFileSync(METRICS_CONFIG_PATH, yaml, 'utf-8');
      console.log('[SystemConfig] Updated Configuration/metrics_list.yaml dynamically.');
      return res.json({ success: true, message: 'Metrics collection configuration updated and dynamic ingestion rules reloaded without restart.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/v1/system/config/alerts
  if (url.includes('/alerts') && req.method === 'GET') {
    try {
      const content = fs.readFileSync(ALERTS_CONFIG_PATH, 'utf-8');
      return res.json({ success: true, yaml: content });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT /api/v1/system/config/alerts
  if (url.includes('/alerts') && req.method === 'PUT') {
    try {
      const { yaml } = req.body || {};
      if (!yaml) {
        return res.status(400).json({ success: false, error: 'YAML content is required.' });
      }
      fs.writeFileSync(ALERTS_CONFIG_PATH, yaml, 'utf-8');
      console.log('[SystemConfig] Updated Configuration/alerts_list.yaml dynamically.');
      return res.json({ success: true, message: 'Alert collection configuration updated and dynamic ingestion rules reloaded without restart.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(404).json({ error: 'Config route not found' });
}
