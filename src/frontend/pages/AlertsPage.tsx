import React, { useMemo, useState } from 'react';
import { downloadCsv, formatUtc, instanceQuery, rangeToMs, useApi, type PageProps } from '../api';

const SEVERITIES = ['CRITICAL', 'IMMEDIATE', 'WARNING', 'INFO'];
const SEVERITY_COLORS: Record<string, string> = { critical: '#ef4444', immediate: '#f97316', warning: '#f59e0b', info: '#3b82f6' };
const STATUSES = ['ACTIVE', 'CANCELED', 'ALL'];

export function severityBadge(severity: string): string {
  if (severity === 'CRITICAL' || severity === 'IMMEDIATE') return 'badge-critical';
  if (severity === 'WARNING') return 'badge-warning';
  return 'badge-info';
}

export const AlertsPage: React.FC<PageProps> = ({ onNavigate, instanceId, timeRange }) => {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [search, setSearch] = useState('');

  // Window start is fixed per selected range so re-renders do not change the query.
  const startTime = useMemo(() => Date.now() - rangeToMs(timeRange), [timeRange]);
  const scope = instanceQuery(instanceId);

  const listParams = [
    `status=${statusFilter}`,
    severityFilter !== 'ALL' ? `severity=${severityFilter}` : '',
    search ? `search=${encodeURIComponent(search)}` : '',
    // Active alerts are shown regardless of age; the time window applies to history.
    statusFilter !== 'ACTIVE' ? `startTime=${startTime}` : '',
    scope
  ].filter(Boolean).join('&');

  const alertsReq = useApi<any[]>(`/alerts?${listParams}`);
  const summaryReq = useApi<any>(`/alerts/summary${scope ? `?${scope}` : ''}`);
  const timelineReq = useApi<any[]>(`/alerts/timeline?startTime=${startTime}&buckets=12${scope ? `&${scope}` : ''}`);

  const alerts = Array.isArray(alertsReq.data) ? alertsReq.data : [];
  const summary = summaryReq.data || {};
  const timeline = Array.isArray(timelineReq.data) ? timelineReq.data : [];
  const totalActive = SEVERITIES.reduce((sum, s) => sum + (summary[s.toLowerCase()] || 0), 0);
  const maxBucket = Math.max(1, ...timeline.map(b => b.total));

  const topObjects = useMemo(() => {
    const counts = new Map<string, { name: string; uuid: string; count: number }>();
    for (const a of alerts) {
      const entry = counts.get(a.resourceUuid) || { name: a.resourceName, uuid: a.resourceUuid, count: 0 };
      entry.count += 1;
      counts.set(a.resourceUuid, entry);
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [alertsReq.data]);

  const handleExport = () => {
    downloadCsv(`alerts_export_${Date.now()}.csv`, [
      ['Severity', 'Status', 'Instance', 'Target Resource', 'Resource Kind', 'Alert Name', 'Triggered Time (UTC)', 'Alert ID'],
      ...alerts.map(a => [a.severity, a.status, a.instanceId, a.resourceName, a.resourceKind || '', a.alertName, new Date(a.startTime).toISOString(), a.alertId])
    ]);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Alerts Analysis Workspace</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Multi-dimensional slicing and dicing of alerts across all VCF Operations instances</p>
      </div>

      {/* Faceted Filter Toolbar */}
      <div className="panel" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="alert-severity" style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Severity</label>
          <select id="alert-severity" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="ALL">All Severities</option>
            {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="alert-status" style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Status</label>
          <select id="alert-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '240px' }}>
          <label htmlFor="alert-search" style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Search Alerts or Resources</label>
          <input
            id="alert-search"
            type="text"
            placeholder="🔍 Type alert name, VM, or ESXi host..."
            style={{ width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={() => { setSeverityFilter('ALL'); setStatusFilter('ACTIVE'); setSearch(''); }}>
          Reset Filters
        </button>
      </div>

      {/* Visual Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Alert Volume Timeline (alerts started per interval)</h3>
          <div data-testid="alert-timeline" style={{ background: '#0f172a', height: '120px', borderRadius: '6px', display: 'flex', alignItems: 'flex-end', gap: '6px', padding: '12px' }}>
            {timeline.map(b => (
              <div
                key={b.timestamp}
                data-testid="timeline-bucket"
                data-total={b.total}
                title={`${formatUtc(b.timestamp)} — Critical: ${b.critical}, Immediate: ${b.immediate}, Warning: ${b.warning}, Info: ${b.info}`}
                style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column-reverse' }}
              >
                {SEVERITIES.map(s => s.toLowerCase()).filter(s => b[s] > 0).map(s => (
                  <div key={s} style={{ height: `${(b[s] / maxBucket) * 100}%`, background: SEVERITY_COLORS[s] }} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Active Severity Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SEVERITIES.map(s => {
              const count = summary[s.toLowerCase()] || 0;
              return (
                <div key={s} data-testid={`severity-${s}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: SEVERITY_COLORS[s.toLowerCase()] }}>● {s}</span>
                  <strong>{count} ({totalActive ? Math.round((count / totalActive) * 100) : 0}%)</strong>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Top Alerting Objects</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            {topObjects.length === 0 && <span style={{ color: '#94a3b8' }}>No alerts match the filters.</span>}
            {topObjects.map(o => (
              <div key={o.uuid} data-testid="top-object" style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => onNavigate(`/objects/${encodeURIComponent(o.uuid)}`)}>
                <span>{o.name}</span>
                <strong>{o.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Data Table */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{statusFilter === 'ALL' ? 'Alerts' : `${statusFilter.charAt(0)}${statusFilter.slice(1).toLowerCase()} Alerts`} ({alerts.length})</h3>
          <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={handleExport}>📥 Export CSV</button>
        </div>

        {alertsReq.error && <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '12px' }}>⚠️ Could not load alerts: {alertsReq.error}</div>}

        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Status</th>
              <th>VCF Instance</th>
              <th>Target Resource</th>
              <th>Alert Name</th>
              <th>Triggered Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && !alertsReq.loading && (
              <tr><td colSpan={7} style={{ color: '#94a3b8', textAlign: 'center' }}>No alerts match the current filters.</td></tr>
            )}
            {alerts.map(a => (
              <tr key={a.alertId} data-testid="alert-row" style={{ cursor: 'pointer' }} onClick={() => onNavigate(`/alerts/${encodeURIComponent(a.alertId)}`)}>
                <td>
                  <span className={`badge ${severityBadge(a.severity)}`}>{a.severity}</span>
                </td>
                <td>{a.status}</td>
                <td>{a.instanceId}</td>
                <td><strong>{a.resourceName}</strong></td>
                <td>{a.alertName}</td>
                <td>{formatUtc(a.startTime)}</td>
                <td>
                  <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); onNavigate(`/alerts/${encodeURIComponent(a.alertId)}`); }}>
                    Inspect ➔
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
