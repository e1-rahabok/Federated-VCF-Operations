import React, { useState } from 'react';
import { StatCard } from '../components/StatCard';

interface MetricsPageProps {
  onNavigate: (path: string) => void;
}

export const MetricsPage: React.FC<MetricsPageProps> = ({ onNavigate }) => {
  const [resolution, setResolution] = useState<'1m' | '5m' | '1h'>('5m');
  const [selectedVm, setSelectedVm] = useState(true);
  const [selectedHost, setSelectedHost] = useState(false);
  const [searchTree, setSearchTree] = useState('');

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
          {/* Resource Tree Explorer Panel */}
          <div className="panel">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>🌳 Resource Tree Explorer</h3>
            <input
              type="text"
              placeholder="🔍 Search VMs or Hosts..."
              style={{ width: '100%', marginBottom: '12px' }}
              value={searchTree}
              onChange={(e) => setSearchTree(e.target.value)}
            />
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <strong>📁 VCF-Ops-01 / Cluster-vSAN-01</strong>
                <div style={{ paddingLeft: '16px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedVm} onChange={(e) => setSelectedVm(e.target.checked)} />
                    <span>💻 VM-007 (SQL-Prod)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedHost} onChange={(e) => setSelectedHost(e.target.checked)} />
                    <span>🖥️ esx-01.corp.local</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Category Checklist */}
          <div className="panel">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>📊 Metric Categories</h3>
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span><code>cpu|usage_average</code> (%)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span><code>cpu|ready_summation</code> (ms)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked />
                <span><code>mem|usage_average</code> (%)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" />
                <span><code>virtualDisk|totalLatency</code> (ms)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Main Chart Canvas Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Resolution & Toolbar Bar */}
          <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>Granularity Resolution:</span>
              <button className={resolution === '1m' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setResolution('1m')}>
                1-Min Raw
              </button>
              <button className={resolution === '5m' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setResolution('5m')}>
                5-Min Rollup
              </button>
              <button className={resolution === '1h' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setResolution('1h')}>
                1-Hour Rollup
              </button>
            </div>

            <button className="btn-secondary" style={{ fontSize: '12px' }}>📥 Export CSV Dataset</button>
          </div>

          {/* Chart Panel 1: CPU Performance */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700 }}>CPU Utilization (%) vs CPU Ready Time (ms)</h3>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>🔵 VM-007 CPU % | 🟠 VM-007 Ready ms</div>
            </div>
            <div style={{ background: '#0f172a', height: '180px', borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: '90%', height: '100px', borderBottom: '2px solid #334155', position: 'relative' }}>
                {/* SVG Mock Timeseries Overlay */}
                <svg width="100%" height="100%" style={{ overflow: 'visible' }}>
                  <path d="M 0 60 Q 100 20, 200 70 T 400 30 T 600 80 T 800 40" fill="none" stroke="#3b82f6" strokeWidth="3" />
                  <path d="M 0 80 Q 100 90, 200 40 T 400 85 T 600 50 T 800 75" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4" />
                </svg>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px' }}>Synchronized Crosshair Canvas • Drag to Zoom Window</div>
            </div>
          </div>

          {/* Statistical Percentile Cards Grid */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <StatCard label="Minimum (Min)" value="12.4%" subtext="Lowest recorded point" icon="📉" accentColor="#3b82f6" />
            <StatCard label="Maximum (Max)" value="98.2%" subtext="Peak spike threshold" icon="📊" accentColor="#ef4444" />
            <StatCard label="Mean Average (Avg)" value="45.1%" subtext="Window mean average" icon="📈" accentColor="#10b981" />
            <StatCard label="95th Percentile (P95)" value="88.4%" subtext="Capacity sizing benchmark" icon="🎯" accentColor="#f59e0b" />
            <StatCard label="99th Percentile (P99)" value="94.6%" subtext="SLA compliance threshold" icon="🔥" accentColor="#ef4444" />
          </div>
        </div>
      </div>
    </div>
  );
};
