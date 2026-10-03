import React, { useState } from 'react';

interface AlertsPageProps {
  onNavigate: (path: string) => void;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({ onNavigate }) => {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [instanceFilter, setInstanceFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const mockAlerts = [
    { alertId: 'alt-98234-vcf', instanceId: 'VCF-Ops-01', resourceName: 'VM-007 (SQL-Prod)', alertName: 'High CPU Ready Latency on Virtual Machine VM-007', severity: 'WARNING', time: '2026-10-03 10:18 UTC' },
    { alertId: 'alt-98235-vcf', instanceId: 'VCF-Ops-02', resourceName: 'esx-02.corp.local', alertName: 'Physical Power Supply Unit Fault', severity: 'CRITICAL', time: '2026-10-03 10:15 UTC' },
    { alertId: 'alt-98236-vcf', instanceId: 'VCF-Ops-01', resourceName: 'vsanDatastore', alertName: 'Datastore Capacity Usage Exceeds 85% Warning', severity: 'WARNING', time: '2026-10-03 09:45 UTC' },
    { alertId: 'alt-98237-vcf', instanceId: 'VCF-Ops-01', resourceName: 'VM-008 (Web-App)', alertName: 'Snapshot age exceeds 7 days', severity: 'INFO', time: '2026-10-03 08:30 UTC' }
  ];

  const filteredAlerts = mockAlerts.filter(a => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (instanceFilter !== 'ALL' && a.instanceId !== instanceFilter) return false;
    if (search && !a.alertName.toLowerCase().includes(search.toLowerCase()) && !a.resourceName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Alerts Analysis Workspace</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Multi-dimensional slicing and dicing of alerts across all VCF Operations instances</p>
      </div>

      {/* Faceted Filter Toolbar */}
      <div className="panel" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>VCF Instance</label>
          <select value={instanceFilter} onChange={(e) => setInstanceFilter(e.target.value)}>
            <option value="ALL">All Instances</option>
            <option value="VCF-Ops-01">VCF-Ops-01</option>
            <option value="VCF-Ops-02">VCF-Ops-02</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Severity</label>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
        </div>

        <div style={{ flex: 1, minWidth: '240px' }}>
          <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Search Alerts or Resources</label>
          <input
            type="text"
            placeholder="🔍 Type alert name, VM, or ESXi host..."
            style={{ width: '100%' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button className="btn-secondary" style={{ alignSelf: 'flex-end' }} onClick={() => { setSeverityFilter('ALL'); setInstanceFilter('ALL'); setSearch(''); }}>
          Reset Filters
        </button>
      </div>

      {/* Visual Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Alert Volume Timeline (Stacked Bar)</h3>
          <div style={{ background: '#0f172a', height: '120px', borderRadius: '6px', display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '16px' }}>
            <div style={{ flex: 1, height: '40%', background: '#f59e0b', borderRadius: '4px' }} title="Warning: 4"></div>
            <div style={{ flex: 1, height: '80%', background: '#ef4444', borderRadius: '4px' }} title="Critical: 8"></div>
            <div style={{ flex: 1, height: '30%', background: '#f59e0b', borderRadius: '4px' }} title="Warning: 3"></div>
            <div style={{ flex: 1, height: '60%', background: '#3b82f6', borderRadius: '4px' }} title="Info: 6"></div>
            <div style={{ flex: 1, height: '90%', background: '#ef4444', borderRadius: '4px' }} title="Critical: 9"></div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Severity Distribution</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>🚨 Critical</span>
              <strong style={{ color: '#fca5a5' }}>3 (12%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>⚠️ Warning</span>
              <strong style={{ color: '#fcd34d' }}>14 (56%)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>ℹ️ Info</span>
              <strong style={{ color: '#93c5fd' }}>8 (32%)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Data Table */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Active Alerts ({filteredAlerts.length})</h3>
          <button className="btn-secondary" style={{ fontSize: '12px' }}>📥 Export CSV</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>VCF Instance</th>
              <th>Target Resource</th>
              <th>Alert Name</th>
              <th>Triggered Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map(a => (
              <tr key={a.alertId} style={{ cursor: 'pointer' }} onClick={() => onNavigate(`/alerts/${a.alertId}`)}>
                <td>
                  <span className={`badge badge-${a.severity.toLowerCase()}`}>{a.severity}</span>
                </td>
                <td>{a.instanceId}</td>
                <td><strong>{a.resourceName}</strong></td>
                <td>{a.alertName}</td>
                <td>{a.time}</td>
                <td>
                  <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); onNavigate(`/alerts/${a.alertId}`); }}>
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
