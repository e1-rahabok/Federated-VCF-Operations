/**
 * Parser for Configuration/metrics_list.yaml and Configuration/alerts_list.yaml.
 * Pure string logic with no Node or browser dependencies, so the ingestion engine,
 * the REST API and the Settings page all read collection rules the same way.
 */

export const OBJECT_KINDS = ['VirtualMachine', 'HostSystem', 'ClusterComputeResource', 'Datastore'] as const;
export type ObjectKind = typeof OBJECT_KINDS[number];

export interface MetricRule {
  key: string;
  name: string;
  unit: string;
  description: string;
  active: boolean;
}

export interface PropertyRule {
  key: string;
  name: string;
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
    properties: PropertyRule[];
    alert_filters: AlertFilterRule[];
  }>;
}

export function parseYamlConfig(text: string): ParsedConfig {
  const result: ParsedConfig = {
    version: '1.0',
    settings: {},
    object_types: {
      VirtualMachine: { metrics: [], properties: [], alert_filters: [] },
      HostSystem: { metrics: [], properties: [], alert_filters: [] },
      ClusterComputeResource: { metrics: [], properties: [], alert_filters: [] },
      Datastore: { metrics: [], properties: [], alert_filters: [] }
    }
  };

  if (!text) return result;

  let currentKind: string | null = null;
  let currentMetric: MetricRule | null = null;
  let currentAlert: AlertFilterRule | null = null;
  let currentProperty: PropertyRule | null = null;

  const lines = text.split(/\r?\n/);
  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const kindMatch = rawLine.match(/^\s*(VirtualMachine|HostSystem|ClusterComputeResource|Datastore):/);
    if (kindMatch) {
      currentKind = kindMatch[1];
      if (!result.object_types[currentKind]) {
        result.object_types[currentKind] = { metrics: [], properties: [], alert_filters: [] };
      }
      currentMetric = null;
      currentAlert = null;
      currentProperty = null;
      continue;
    }

    if (!currentKind) continue;

    const isCommented = trimmed.startsWith('#');
    const cleanLine = trimmed.replace(/^#\s*/, '');

    if (cleanLine.startsWith('- property_key:')) {
      const colonIdx = cleanLine.indexOf(':');
      const keyVal = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      currentProperty = { key: keyVal, name: keyVal, active: !isCommented };
      result.object_types[currentKind].properties.push(currentProperty);
      currentMetric = null;
      currentAlert = null;
      continue;
    }

    if (currentProperty) {
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1 && cleanLine.substring(0, colonIdx).trim() === 'name') {
        currentProperty.name = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      }
    }

    if (cleanLine.startsWith('- key:')) {
      currentProperty = null;
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
      currentProperty = null;
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
