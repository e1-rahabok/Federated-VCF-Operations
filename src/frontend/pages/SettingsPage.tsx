import React, { useState } from 'react';

export const SettingsPage: React.FC = () => {
  const [showAddModal, setShowModal] = useState(false);
  const [authType, setAuthType] = useState<'OPS_TOKEN' | 'BEARER_TOKEN'>('OPS_TOKEN');
  const [hostname, setHostname] = useState('vcf-ops-03.corp.local');
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [rawRetentionHours, setRawRetentionHours] = useState(48);
  const [summaryRetentionDays, setSummaryRetentionDays] = useState(90);

  const handleTestConnection = async () => {
    setTestStatus({ message: 'Testing REST API connection...' });
    try {
      const res = await fetch('/api/v1/instances/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname, authType })
      });
      const data = await res.json();
      setTestStatus(data);
    } catch (err) {
      setTestStatus({ success: false, message: 'Connection timeout. Unreachable host.' });
    }
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>System & VCF Instance Configuration</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Manage connected VCF Operations 9 instances, authentication methods, and data retention rules</p>
      </div>

      {saveSuccess && (
        <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
          ✅ System settings and retention policies updated successfully!
        </div>
      )}

      {/* Instance Management Table */}
      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>VCF Operations 9 Instances Management</h3>
          <button className="btn-primary" onClick={() => setShowModal(true)}>+ Add VCF Instance Connection</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Instance Name</th>
              <th>Hostname / IP</th>
              <th>Authentication Method</th>
              <th>Polling Frequency</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>VCF-Ops-01</strong></td>
              <td><code>vcf-ops-01.corp.local</code></td>
              <td>Option A: OpsToken (Local)</td>
              <td>60 seconds</td>
              <td><span className="badge badge-healthy">HEALTHY</span></td>
              <td><button className="btn-secondary" style={{ fontSize: '12px' }}>Edit</button></td>
            </tr>
            <tr>
              <td><strong>VCF-Ops-02</strong></td>
              <td><code>vcf-ops-02.corp.local</code></td>
              <td>Option B: Bearer Token (VIDB SSO)</td>
              <td>60 seconds</td>
              <td><span className="badge badge-healthy">HEALTHY</span></td>
              <td><button className="btn-secondary" style={{ fontSize: '12px' }}>Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal: Add/Edit Instance Connection */}
      {showAddModal && (
        <div className="panel" style={{ border: '2px solid #3b82f6', background: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>MODAL: Add / Edit VCF Instance Connection</h3>
            <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={() => setShowModal(false)}>✕ Close</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Hostname / IP Address</label>
              <input type="text" style={{ width: '100%' }} value={hostname} onChange={(e) => setHostname(e.target.value)} />
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>Select Authentication Method:</label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="radio" name="auth" checked={authType === 'OPS_TOKEN'} onChange={() => setAuthType('OPS_TOKEN')} />
                  <span>Option A: Local Credentials (OpsToken) - VCF 9.0 & Local</span>
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="radio" name="auth" checked={authType === 'BEARER_TOKEN'} onChange={() => setAuthType('BEARER_TOKEN')} />
                  <span>Option B: VCF SSO / VIDB API Token (Bearer) - VCF 9.1+</span>
                </label>
              </div>
            </div>

            {authType === 'OPS_TOKEN' ? (
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" placeholder="Username (e.g. admin)" defaultValue="admin" style={{ width: '100%' }} />
                <input type="password" placeholder="Password" defaultValue="password123" style={{ width: '100%' }} />
                <input type="text" placeholder="Auth Source (e.g. LOCAL)" defaultValue="LOCAL" style={{ width: '100%' }} />
              </div>
            ) : (
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" placeholder="VIDB Host FQDN (e.g. vidb.corp.local)" defaultValue="vidb.corp.local" style={{ width: '100%' }} />
                <input type="text" placeholder="Client Name / ID" defaultValue="federated-ops-client" style={{ width: '100%' }} />
                <input type="password" placeholder="API Refresh Token" defaultValue="ref_token_secret_123" style={{ width: '100%' }} />
              </div>
            )}

            {testStatus && (
              <div style={{ background: testStatus.success ? '#064e3b' : '#7f1d1d', color: testStatus.success ? '#6ee7b7' : '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                {testStatus.message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button className="btn-secondary" onClick={handleTestConnection}>🧪 Test Connection</button>
              <button className="btn-primary" onClick={() => { setShowModal(false); setSaveSuccess(true); }}>💾 Save Instance</button>
            </div>
          </div>
        </div>
      )}

      {/* Retention & System Settings Panel */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Data Retention & Pruning Policies</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Raw 1-Minute Metrics Buffer Retention (Hours)</label>
            <input type="number" style={{ width: '100%' }} value={rawRetentionHours} onChange={(e) => setRawRetentionHours(parseInt(e.target.value, 10))} />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Unaggregated high-res metrics buffer (Default: 48 hours)</div>
          </div>

          <div>
            <label style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Summary Rollup Retention (Days)</label>
            <input type="number" style={{ width: '100%' }} value={summaryRetentionDays} onChange={(e) => setSummaryRetentionDays(parseInt(e.target.value, 10))} />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>5-min and 1-hour summary rollups retention (Default: 90 days)</div>
          </div>
        </div>

        <div>
          <button className="btn-primary" style={{ marginTop: '8px' }} onClick={handleSaveSettings}>💾 Save Retention Policies</button>
        </div>
      </div>
    </div>
  );
};
