import React, { useState } from 'react';
import { StatCard } from '../components/StatCard';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSavePreferences = () => {
    setIsCustomizing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Personalized Dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Centralized multi-instance VCF Operations status overview</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => setIsCustomizing(!isCustomizing)}>
            {isCustomizing ? 'Done Editing' : '✏️ Customize Dashboard'}
          </button>
          <button className="btn-primary" onClick={handleSavePreferences}>
            💾 Save Layout Preference
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
          ✅ Dashboard layout preferences saved successfully!
        </div>
      )}

      {/* Summary KPI Cards Row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <StatCard label="Total Monitored VCF Instances" value="5" subtext="All instances reporting" icon="🌐" accentColor="#3b82f6" />
        <StatCard label="Active Critical Alerts" value="3" subtext="Requires immediate triage" icon="🚨" accentColor="#ef4444" />
        <StatCard label="Total Monitored Objects" value="12,450" subtext="VMs, ESXi Hosts, Clusters" icon="📦" accentColor="#10b981" />
        <StatCard label="Ingestion Metric Delta Rate" value="21,300/m" subtext="1-min high-watermark delta" icon="⚡" accentColor="#f59e0b" />
      </div>

      {/* 2x2 Widget Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Widget 1: Active Alerts Summary */}
        <div className="panel" style={{ border: isCustomizing ? '2px dashed #3b82f6' : '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Active Alerts Summary</h3>
            <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => onNavigate('/alerts')}>
              View All Alerts ➔
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, background: '#7f1d1d', padding: '12px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => onNavigate('/alerts?severity=CRITICAL')}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fca5a5' }}>3</div>
              <div style={{ fontSize: '12px', color: '#fca5a5' }}>CRITICAL</div>
            </div>
            <div style={{ flex: 1, background: '#78350f', padding: '12px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => onNavigate('/alerts?severity=WARNING')}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#fcd34d' }}>14</div>
              <div style={{ fontSize: '12px', color: '#fcd34d' }}>WARNING</div>
            </div>
            <div style={{ flex: 1, background: '#1e3a8a', padding: '12px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => onNavigate('/alerts?severity=INFO')}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#93c5fd' }}>8</div>
              <div style={{ fontSize: '12px', color: '#93c5fd' }}>INFO</div>
            </div>
          </div>
          <div style={{ fontSize: '13px', background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
            🔥 <strong>Top Alert:</strong> <span style={{ color: '#fca5a5' }}>Physical Power Supply Unit Fault</span> on host <code>esx-02.corp.local</code> (VCF-Ops-02)
          </div>
        </div>

        {/* Widget 2: Pinned Infrastructure Objects */}
        <div className="panel" style={{ border: isCustomizing ? '2px dashed #3b82f6' : '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Pinned Infrastructure Objects</h3>
            <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => onNavigate('/metrics')}>
              Explore Tree ➔
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Resource Name</th>
                <th>Kind</th>
                <th>CPU Usage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ cursor: 'pointer' }} onClick={() => onNavigate('/objects/cluster-01')}>
                <td><strong>Cluster-vSAN-01</strong></td>
                <td>Cluster</td>
                <td>78%</td>
                <td><span className="badge badge-healthy">HEALTHY</span></td>
              </tr>
              <tr style={{ cursor: 'pointer' }} onClick={() => onNavigate('/objects/vm-007')}>
                <td><strong>VM-007 (SQL-Prod)</strong></td>
                <td>VirtualMachine</td>
                <td>94%</td>
                <td><span className="badge badge-warning">WARNING</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Widget 3: VCF Ingestion Status */}
        <div className="panel" style={{ border: isCustomizing ? '2px dashed #3b82f6' : '1px solid #334155' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>VCF Operations Ingestion Status</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '12px', borderRadius: '6px' }}>
              <div>
                <strong>VCF-Ops-01 (Datacenter East)</strong>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>vcf-ops-01.corp.local | OpsToken Auth</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-healthy">HEALTHY</span>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>12,400 m/min</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '12px', borderRadius: '6px' }}>
              <div>
                <strong>VCF-Ops-02 (Datacenter West)</strong>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>vcf-ops-02.corp.local | Bearer Token Auth</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-healthy">HEALTHY</span>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>8,900 m/min</div>
              </div>
            </div>
          </div>
        </div>

        {/* Widget 4: Quick Metrics Launcher */}
        <div className="panel" style={{ border: isCustomizing ? '2px dashed #3b82f6' : '1px solid #334155' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Quick Metrics Launcher</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn-secondary" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between' }} onClick={() => onNavigate('/metrics')}>
              <span>📊 Host CPU Utilization Comparison</span>
              <span>➔</span>
            </button>
            <button className="btn-secondary" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between' }} onClick={() => onNavigate('/metrics')}>
              <span>💾 Datastore Capacity Exhaustion Trends</span>
              <span>➔</span>
            </button>
            <button className="btn-secondary" style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between' }} onClick={() => onNavigate('/metrics')}>
              <span>⚡ VM CPU Ready Latency Overlay (Top 10)</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
