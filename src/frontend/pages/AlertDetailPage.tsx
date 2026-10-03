import React from 'react';

interface AlertDetailPageProps {
  alertId: string;
  onNavigate: (path: string) => void;
}

export const AlertDetailPage: React.FC<AlertDetailPageProps> = ({ alertId, onNavigate }) => {
  const handleOpenNativeConsole = () => {
    window.open('https://vcf-ops-01.corp.local/ui/index.action#...', '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <button className="btn-secondary" style={{ marginBottom: '12px', fontSize: '13px' }} onClick={() => onNavigate('/alerts')}>
          ⬅️ Back to Alerts Analysis
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>ALERT DETAILS: High CPU Ready Latency on Virtual Machine VM-007</h1>
      </div>

      {/* Properties & Context Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>ALERT PROPERTIES</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>Alert ID:</strong> <code>{alertId}</code></div>
            <div><strong>Severity:</strong> <span className="badge badge-warning">WARNING</span></div>
            <div><strong>Status:</strong> <span className="badge badge-healthy">ACTIVE</span></div>
            <div><strong>Trigger Time:</strong> 2026-10-03 10:18:00 UTC</div>
            <div><strong>Metric Key:</strong> <code>cpu|ready_summation</code> (Spike threshold &gt; 20ms)</div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>IMPACTED RESOURCE CONTEXT</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>Resource Name:</strong> <strong style={{ cursor: 'pointer', color: '#3b82f6' }} onClick={() => onNavigate('/objects/vm-007')}>VM-007 (SQL-Prod)</strong></div>
            <div><strong>Resource Kind:</strong> VirtualMachine</div>
            <div><strong>Host System:</strong> <code>esx-04.corp.local</code></div>
            <div><strong>VCF Instance:</strong> VCF-Ops-01 (Datacenter East)</div>
          </div>
        </div>
      </div>

      {/* Triggering Metric Overlay Chart Container */}
      <div className="panel">
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Triggering Metric Timeseries Overlay</h3>
        <div style={{ background: '#0f172a', height: '180px', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>📈 <code>cpu|ready_summation</code> (ms) Timeline Chart</div>
          <div style={{ width: '80%', height: '80px', borderBottom: '2px solid #3b82f6', position: 'relative' }}>
            <div style={{ position: 'absolute', right: '30%', top: '10px', background: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
              ⚡ Trigger Spike: 28.4ms @ 10:18 UTC
            </div>
          </div>
        </div>
      </div>

      {/* External Action Toolbar */}
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
        <div>
          <strong style={{ fontSize: '14px' }}>Need deep troubleshooting in source environment?</strong>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Direct link launcher constructs target VCF Operations 9 console URL</div>
        </div>
        <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }} onClick={handleOpenNativeConsole}>
          🚀 Open Alert in VCF Operations Console ➔
        </button>
      </div>
    </div>
  );
};
