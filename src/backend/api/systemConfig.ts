import fs from 'node:fs';
import path from 'node:path';

const METRICS_CONFIG_PATH = path.resolve(process.cwd(), 'Configuration/metrics_list.yaml');
const ALERTS_CONFIG_PATH = path.resolve(process.cwd(), 'Configuration/alerts_list.yaml');

export interface MetricRule {
  key: string;
  name: string;
  unit: string;
  description: string;
  active: boolean;
}

export interface AlertFilterRule {
  alert_sub_type: string;
  name: string;
  min_severity: string;
  description: string;
  active: boolean;
}

export interface ParsedConfig {
  version: string;
  settings: Record<string, any>;
  object_types: Record<string, {
    description?: string;
    metrics: MetricRule[];
    alert_filters: AlertFilterRule[];
  }>;
}

export function parseYamlConfig(text: string): ParsedConfig {
  const result: ParsedConfig = {
    version: '1.0',
    settings: {},
    object_types: {
      VirtualMachine: { metrics: [], alert_filters: [] },
      HostSystem: { metrics: [], alert_filters: [] },
      ClusterComputeResource: { metrics: [], alert_filters: [] },
      Datastore: { metrics: [], alert_filters: [] }
    }
  };

  if (!text) return result;

  let currentKind: string | null = null;
  let currentMetric: MetricRule | null = null;
  let currentAlert: AlertFilterRule | null = null;

  const lines = text.split(/\r?\n/);
  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const kindMatch = rawLine.match(/^\s*(VirtualMachine|HostSystem|ClusterComputeResource|Datastore):/);
    if (kindMatch) {
      currentKind = kindMatch[1];
      if (!result.object_types[currentKind]) {
        result.object_types[currentKind] = { metrics: [], alert_filters: [] };
      }
      currentMetric = null;
      currentAlert = null;
      continue;
    }

    if (!currentKind) continue;

    const isCommented = trimmed.startsWith('#');
    const cleanLine = trimmed.replace(/^#\s*/, '');

    if (cleanLine.startsWith('- key:')) {
      const colonIdx = cleanLine.indexOf(':');
      const keyVal = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      currentMetric = {
        key: keyVal,
        name: keyVal,
        unit: 'count',
        description: '',
        active: !isCommented
      };
      result.object_types[currentKind].metrics.push(currentMetric);
      currentAlert = null;
      continue;
    }

    if (cleanLine.startsWith('- alert_sub_type:')) {
      const colonIdx = cleanLine.indexOf(':');
      const subVal = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      currentAlert = {
        alert_sub_type: subVal,
        name: subVal,
        min_severity: 'WARNING',
        description: '',
        active: !isCommented
      };
      result.object_types[currentKind].alert_filters.push(currentAlert);
      currentMetric = null;
      continue;
    }

    if (currentMetric) {
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1) {
        const prop = cleanLine.substring(0, colonIdx).trim();
        const val = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (prop === 'name') currentMetric.name = val;
        else if (prop === 'unit') currentMetric.unit = val;
        else if (prop === 'description') currentMetric.description = val;
      }
    }

    if (currentAlert) {
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1) {
        const prop = cleanLine.substring(0, colonIdx).trim();
        const val = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (prop === 'name') currentAlert.name = val;
        else if (prop === 'min_severity') currentAlert.min_severity = val;
        else if (prop === 'description') currentAlert.description = val;
      }
    }
  }

  return result;
}

export default function systemConfigRoutes(req: any, res: any, next: any) {
  const url = req.url || '';

  // GET /api/v1/system/config/metrics
  if (url.includes('/metrics') && req.method === 'GET') {
    try {
      const content = fs.readFileSync(METRICS_CONFIG_PATH, 'utf-8');
      const parsed = parseYamlConfig(content);
      return res.json({ success: true, yaml: content, config: parsed });
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
      const parsed = parseYamlConfig(content);
      return res.json({ success: true, yaml: content, config: parsed });
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
