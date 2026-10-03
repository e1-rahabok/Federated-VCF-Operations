import React from 'react';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  selectedInstance: string;
  onSelectInstance: (instanceId: string) => void;
  selectedTimeRange: string;
  onSelectTimeRange: (range: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  onNavigate,
  selectedInstance,
  onSelectInstance,
  selectedTimeRange,
  onSelectTimeRange
}) => {
  return (
    <header style={{ background: '#1e293b', borderBottom: '1px solid #334155' }}>
      {/* Top Global Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => onNavigate('/')}>
            <span style={{ fontSize: '20px' }}>🌐</span>
            <span style={{ fontWeight: 800, fontSize: '18px', color: '#f8fafc' }}>Federated VCF Ops</span>
          </div>

          <nav style={{ display: 'flex', gap: '8px' }}>
            <button
              className={currentPath === '/' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onNavigate('/')}
            >
              Home
            </button>
            <button
              className={currentPath.startsWith('/alerts') ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onNavigate('/alerts')}
            >
              Alerts
            </button>
            <button
              className={currentPath.startsWith('/metrics') || currentPath.startsWith('/objects') ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onNavigate('/metrics')}
            >
              Metrics
            </button>
            <button
              className={currentPath === '/settings' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => onNavigate('/settings')}
            >
              Settings
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', marginRight: '6px' }}>Instance Scope:</label>
            <select value={selectedInstance} onChange={(e) => onSelectInstance(e.target.value)}>
              <option value="ALL">All VCF Instances (5)</option>
              <option value="vcf-ops-01">VCF-Ops-01 (Datacenter East)</option>
              <option value="vcf-ops-02">VCF-Ops-02 (Datacenter West)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#94a3b8', marginRight: '6px' }}>Time Range:</label>
            <select value={selectedTimeRange} onChange={(e) => onSelectTimeRange(e.target.value)}>
              <option value="1h">Last 1 Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live System Ingestion Health Banner */}
      <div style={{ background: '#0f172a', padding: '6px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #1e293b' }}>
        <span className="badge badge-healthy">🟢 Ingestion Online</span>
        <span style={{ color: '#94a3b8' }}>All 5 VCF Operations 9 instances connected. Last 1-minute delta poll completed 8s ago.</span>
      </div>
    </header>
  );
};
