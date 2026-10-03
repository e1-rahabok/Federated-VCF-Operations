import React from 'react';

interface ObjectDetailPageProps {
  resourceUuid: string;
  onNavigate: (path: string) => void;
}

export const ObjectDetailPage: React.FC<ObjectDetailPageProps> = ({ resourceUuid, onNavigate }) => {
  const handleOpenNativeConsole = () => {
    window.open(`https://vcf-ops-01.corp.local/ui/index.action#...`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <button className="btn-secondary" style={{ marginBottom: '12px', fontSize: '13px' }} onClick={() => onNavigate('/metrics')}>
          ⬅️ Back to Metrics Analysis
        </button>
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>OBJECT DETAIL: VirtualMachine - {resourceUuid} (SQL-Database-Prod)</h1>
      </div>

      {/* Summary Properties & Hierarchy Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>OBJECT PROPERTIES SUMMARY</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>VCF Instance:</strong> VCF-Ops-01 (Datacenter East)</div>
            <div><strong>Adapter Type:</strong> VMWARE</div>
            <div><strong>IP Address:</strong> 10.20.30.45</div>
            <div><strong>Guest OS:</strong> RHEL 9 (64-bit)</div>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>PARENT HIERARCHY BREADCRUMBS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>vCenter:</strong> <code>vc-01.corp.local</code></div>
            <div><strong>Cluster:</strong> <code>Cluster-vSAN-01</code></div>
            <div><strong>ESXi Host:</strong> <code>esx-04.corp.local</code></div>
            <div><strong>Datastore:</strong> <code>vsanDatastore</code></div>
          </div>
        </div>
      </div>

      {/* Active Alerts Bound to this Resource */}
      <div className="panel">
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Active Alerts on this Resource (2 Active)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: '#78350f', padding: '12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => onNavigate('/alerts/alt-98234-vcf')}>
            <span>⚠️ [WARNING] High CPU Ready Latency (Triggered 18 mins ago)</span>
            <span>Inspect Alert ➔</span>
          </div>
          <div style={{ background: '#1e3a8a', padding: '12px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>ℹ️ [INFO] Snapshot age exceeds 7 days</span>
            <span>Triggered 3h ago</span>
          </div>
        </div>
      </div>

      {/* Key Performance Metric Charts Grid (2x2) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>CPU Utilization (%)</h4>
          <div style={{ background: '#0f172a', height: '100px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            📈 Current: 94% Avg | Peak: 98%
          </div>
        </div>

        <div className="panel">
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Memory Consumed (KB)</h4>
          <div style={{ background: '#0f172a', height: '100px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            📈 Consumed: 32 GB / 64 GB Configured
          </div>
        </div>

        <div className="panel">
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Virtual Disk Latency (ms)</h4>
          <div style={{ background: '#0f172a', height: '100px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            📈 Read Latency: 2.1ms | Write Latency: 4.8ms
          </div>
        </div>

        <div className="panel">
          <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Network Throughput (KB/s)</h4>
          <div style={{ background: '#0f172a', height: '100px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
            📈 Rx: 14,200 KB/s | Tx: 8,900 KB/s
          </div>
        </div>
      </div>

      {/* External Action Toolbar */}
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a' }}>
        <div>
          <strong style={{ fontSize: '14px' }}>Want to manage or configure this object directly?</strong>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Opens source VCF Operations 9 web console in a new browser tab</div>
        </div>
        <button className="btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }} onClick={handleOpenNativeConsole}>
          🚀 Open Object in VCF Operations Console ➔
        </button>
      </div>
    </div>
  );
};
