import React from 'react';
import { TIME_RANGES, useApi } from '../api';

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
  // Re-read on navigation so instances added or removed in Settings show up in the scope list.
  const { data } = useApi<any[]>(`/instances?nav=${encodeURIComponent(currentPath)}`);
  const instances = Array.isArray(data) ? data : [];

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
            <label htmlFor="instance-scope" style={{ fontSize: '12px', color: '#94a3b8', marginRight: '6px' }}>Instance Scope:</label>
            <select id="instance-scope" value={selectedInstance} onChange={(e) => onSelectInstance(e.target.value)}>
              <option value="ALL">All VCF Instances ({instances.length})</option>
              {instances.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="time-range" style={{ fontSize: '12px', color: '#94a3b8', marginRight: '6px' }}>Time Range:</label>
            <select id="time-range" value={selectedTimeRange} onChange={(e) => onSelectTimeRange(e.target.value)}>
              {TIME_RANGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
