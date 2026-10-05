import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.ts';
import { parseYamlConfig, type MetricRule, type ParsedConfig } from '../../shared/telemetryConfig.ts';

export const METRICS_CONFIG_PATH = path.join(CONFIG.CONFIG_DIR, 'metrics_list.yaml');
export const ALERTS_CONFIG_PATH = path.join(CONFIG.CONFIG_DIR, 'alerts_list.yaml');

/**
 * Reads metrics_list.yaml from disk. The scheduler calls this at the start of every
 * polling cycle, so a save from the Settings page takes effect on the next cycle.
 */
export function loadMetricsConfig(): ParsedConfig {
  return parseYamlConfig(fs.readFileSync(METRICS_CONFIG_PATH, 'utf-8'));
}

/** Active (not commented out) stat keys per resource kind. */
export function activeStatKeysByKind(config: ParsedConfig): Record<string, string[]> {
  const byKind: Record<string, string[]> = {};
  for (const [kind, rules] of Object.entries(config.object_types)) {
    byKind[kind] = rules.metrics.filter(m => m.active && m.key).map(m => m.key);
  }
  return byKind;
}

/** Active (not commented out) property keys per resource kind. */
export function activePropertyKeysByKind(config: ParsedConfig): Record<string, string[]> {
  const byKind: Record<string, string[]> = {};
  for (const [kind, rules] of Object.entries(config.object_types)) {
    byKind[kind] = rules.properties.filter(p => p.active && p.key).map(p => p.key);
  }
  return byKind;
}

/** Display name and unit for a stat key on a given resource kind, when the YAML defines one. */
export function findMetricRule(config: ParsedConfig, kind: string, statKey: string): MetricRule | undefined {
  return config.object_types[kind]?.metrics.find(m => m.key === statKey);
}
