import React, { useEffect, useMemo, useState } from 'react';
import { StatCard } from '../components/StatCard';
import { MetricCharts, type MetricKey } from '../components/MetricCharts';
import type { ChartPoint } from '../components/TimeSeriesChart';
import { downloadCsv, formatValue, instanceQuery, rangeToMs, useApi, type PageProps } from '../api';

type Resolution = '1m' | '5m' | '1h';
const RESOLUTIONS: Array<{ value: Resolution; label: string }> = [
  { value: '1m', label: 'Raw Samples' },
  { value: '5m', label: '5-Min Average' },
  { value: '1h', label: '1-Hour Average' }
];

function percentile(sorted: number[], fraction: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

export const MetricsPage: React.FC<PageProps> = ({ onNavigate, instanceId, timeRange }) => {
  const [resolution, setResolution] = useState<Resolution>('5m');
  const [selected, setSelected] = useState<{ instanceId: string; uuid: string; name: string } | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [statsKey, setStatsKey] = useState<string>('');
  const [searchTree, setSearchTree] = useState('');
  const [visiblePoints, setVisiblePoints] = useState<ChartPoint[]>([]);

  const scope = instanceQuery(instanceId);
  const treeReq = useApi<any[]>(`/objects/tree${scope ? `?${scope}` : ''}`);
  const tree = Array.isArray(treeReq.data) ? treeReq.data : [];
  const keysReq = useApi<MetricKey[]>(selected ? `/metrics/keys?resourceUuid=${encodeURIComponent(selected.uuid)}&instanceId=${encodeURIComponent(selected.instanceId)}` : null);
  const availableKeys = Array.isArray(keysReq.data) ? keysReq.data : [];
  const startTime = useMemo(() => Date.now() - rangeToMs(timeRange), [timeRange]);

  // Default selection: every collected key of the chosen resource; statistics on the first one.
  useEffect(() => {
    const all = availableKeys.map(k => k.statKey);
    setSelectedKeys(all);
    setStatsKey(all[0] || '');
    setVisiblePoints([]);
  }, [keysReq.data]);

  const chartKeys = availableKeys.filter(k => selectedKeys.includes(k.statKey));
  const statsMeta = availableKeys.find(k => k.statKey === statsKey);
  const stats = useMemo(() => {
    const values = visiblePoints.map(p => p[statsKey]).filter(v => typeof v === 'number').sort((a, b) => a - b);
    if (values.length === 0) return null;
    return {
      min: values[0],
      max: values[values.length - 1],
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      p95: percentile(values, 0.95),
      p99: percentile(values, 0.99),
      count: values.length
    };
  }, [visiblePoints, statsKey]);

  const toggleKey = (statKey: string) => {
    setSelectedKeys(current => current.includes(statKey) ? current.filter(k => k !== statKey) : [...current, statKey]);
  };

  const handleExport = () => {
    downloadCsv(`metrics_export_${Date.now()}.csv`, [
      ['Timestamp (UTC)', ...chartKeys.map(k => k.name)],
      ...visiblePoints.map(p => [new Date(p.timestamp).toISOString(), ...chartKeys.map(k => p[k.statKey] ?? '')])
    ]);
  };

  const needle = searchTree.trim().toLowerCase();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Metrics Analysis Dashboard</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Multi-metric comparative exploration, percentile calculations, and dynamic rollups</p>
      </div>

      {/* Main Split Layout Workspace */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px' }}>
        {/* Left Sidebar: Resource Tree & Metric Selection Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="panel">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>🌳 Resource Tree Explorer</h3>
            <input
              type="text"
              aria-label="Search resources"
              placeholder="🔍 Search VMs or Hosts..."
              style={{ width: '100%', marginBottom: '12px' }}
              value={searchTree}
              onChange={(e) => setSearchTree(e.target.value)}
            />
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '480px', overflowY: 'auto' }}>
              {tree.length === 0 && !treeReq.loading && <span style={{ color: '#94a3b8' }}>No resources have been collected yet.</span>}
              {tree.map(inst => (
                <div key={inst.id}>
                  <strong>📁 {inst.name}</strong>
                  {inst.kinds.length === 0 && <div style={{ paddingLeft: '16px', color: '#94a3b8', marginTop: '4px' }}>No resources collected.</div>}
                  {inst.kinds.map((group: any) => {
                    const matches = group.resources.filter((r: any) => !needle || r.name.toLowerCase().includes(needle));
                    if (matches.length === 0) return null;
                    return (
                      <div key={group.kind} style={{ paddingLeft: '12px', marginTop: '6px' }}>
                        <div style={{ color: '#94a3b8' }}>{group.kind} ({matches.length})</div>
                        <div style={{ paddingLeft: '8px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {matches.map((r: any) => (
                            <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="resource"
                                checked={selected?.uuid === r.id && selected?.instanceId === inst.id}
                                onChange={() => setSelected({ instanceId: inst.id, uuid: r.id, name: r.name })}
                              />
                              <span>{r.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>📊 Collected Metrics</h3>
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!selected && <span style={{ color: '#94a3b8' }}>Select a resource to list its metrics.</span>}
              {selected && availableKeys.length === 0 && !keysReq.loading && <span style={{ color: '#94a3b8' }}>No samples collected for {selected.name}.</span>}
              {availableKeys.map(k => (
                <label key={k.statKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedKeys.includes(k.statKey)} onChange={() => toggleKey(k.statKey)} />
                  <span>{k.name} <code>{k.statKey}</code></span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Main Chart Canvas Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Granularity Resolution:</span>
              {RESOLUTIONS.map(r => (
                <button key={r.value} className={resolution === r.value ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setResolution(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {selected && (
                <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={() => onNavigate(`/objects/${encodeURIComponent(selected.uuid)}`)}>
                  Open Object Detail ➔
                </button>
              )}
              <button className="btn-secondary" style={{ fontSize: '12px' }} disabled={visiblePoints.length === 0} onClick={handleExport}>📥 Export CSV Dataset</button>
            </div>
          </div>

          {!selected ? (
            <div className="panel" style={{ color: '#94a3b8', fontSize: '14px' }}>Select a resource in the tree to chart its collected metrics.</div>
          ) : (
            <MetricCharts
              resourceUuid={selected.uuid}
              instanceId={selected.instanceId}
              keys={chartKeys}
              resolution={resolution}
              startTime={startTime}
              onVisiblePoints={setVisiblePoints}
            />
          )}

          {/* Statistics for the visible window (recomputed on zoom) */}
          {selected && chartKeys.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <label htmlFor="stats-key" style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Statistics for:</label>
                <select id="stats-key" value={statsKey} onChange={(e) => setStatsKey(e.target.value)}>
                  {chartKeys.map(k => <option key={k.statKey} value={k.statKey}>{k.name}</option>)}
                </select>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{stats ? `${stats.count} points in view` : 'no points in view'}{statsMeta?.unit ? ` · unit: ${statsMeta.unit}` : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <StatCard label="Minimum (Min)" value={formatValue(stats?.min)} icon="📉" accentColor="#3b82f6" />
                <StatCard label="Maximum (Max)" value={formatValue(stats?.max)} icon="📊" accentColor="#ef4444" />
                <StatCard label="Mean Average (Avg)" value={formatValue(stats?.avg)} icon="📈" accentColor="#10b981" />
                <StatCard label="95th Percentile (P95)" value={formatValue(stats?.p95)} icon="🎯" accentColor="#f59e0b" />
                <StatCard label="99th Percentile (P99)" value={formatValue(stats?.p99)} icon="🔥" accentColor="#ef4444" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
