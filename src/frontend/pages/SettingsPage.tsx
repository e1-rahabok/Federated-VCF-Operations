import React, { useState, useEffect } from 'react';
import { parseYamlConfig } from '../../backend/api/systemConfig.js';

export const SettingsPage: React.FC = () => {
  const [showAddModal, setShowModal] = useState(false);
  const [authType, setAuthType] = useState<'OPS_TOKEN' | 'BEARER_TOKEN'>('OPS_TOKEN');
  const [hostname, setHostname] = useState('vcf-ops-03.corp.local');
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [rawRetentionHours, setRawRetentionHours] = useState(48);
  const [summaryRetentionDays, setSummaryRetentionDays] = useState(90);

  // Telemetry Config State
  const [configType, setConfigType] = useState<'metrics' | 'alerts'>('metrics');
  const [configMode, setConfigMode] = useState<'grid' | 'yaml'>('grid');
  const [activeKind, setActiveKind] = useState<'VirtualMachine' | 'HostSystem' | 'ClusterComputeResource' | 'Datastore'>('VirtualMachine');
  const [metricsYaml, setMetricsYaml] = useState('');
  const [alertsYaml, setAlertsYaml] = useState('');
  const [configSaveStatus, setConfigSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/system/config/metrics')
      .then(res => res.json())
      .then(d => { if (d.success) setMetricsYaml(d.yaml); })
      .catch(console.error);

    fetch('/api/v1/system/config/alerts')
      .then(res => res.json())
      .then(d => { if (d.success) setAlertsYaml(d.yaml); })
      .catch(console.error);
  }, []);

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

  const handleSaveTelemetryConfig = async () => {
    const isMetrics = configType === 'metrics';
    const payloadYaml = isMetrics ? metricsYaml : alertsYaml;
    const endpoint = isMetrics ? '/api/v1/system/config/metrics' : '/api/v1/system/config/alerts';

    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: payloadYaml })
      });
      const data = await res.json();
      setConfigSaveStatus(data.message || 'Telemetry rules saved and dynamic ingestion rules reloaded without restart!');
      setTimeout(() => setConfigSaveStatus(null), 4000);
    } catch (err) {
      setConfigSaveStatus('Error saving configuration: ' + err);
    }
  };

  const handleToggleItem = (itemKey: string) => {
    const isMetrics = configType === 'metrics';
    const yaml = isMetrics ? metricsYaml : alertsYaml;
    const lines = yaml.split(/\r?\n/);
    let inKind = false;
    let inTargetItem = false;
    let newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const kindMatch = rawLine.match(/^\s*(VirtualMachine|HostSystem|ClusterComputeResource|Datastore):/);
      if (kindMatch) {
        inKind = (kindMatch[1] === activeKind);
        inTargetItem = false;
        newLines.push(rawLine);
        continue;
      }
      if (!inKind) {
        newLines.push(rawLine);
        continue;
      }
      const cleanLine = trimmed.replace(/^#\s*/, '');
      if (cleanLine.startsWith('- key:') || cleanLine.startsWith('- alert_sub_type:')) {
        const colonIdx = cleanLine.indexOf(':');
        const val = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
        inTargetItem = (val === itemKey);
      }
      if (inTargetItem) {
        const isCommented = trimmed.startsWith('#');
        if (isCommented) {
          newLines.push(rawLine.replace(/^(\s*)#\s?/, '$1'));
        } else {
          const indentMatch = rawLine.match(/^(\s*)/);
          const indent = indentMatch ? indentMatch[1] : '';
          newLines.push(indent + '# ' + rawLine.trimStart());
        }
      } else {
        newLines.push(rawLine);
      }
    }

    const updated = newLines.join('\n');
    if (isMetrics) setMetricsYaml(updated);
    else setAlertsYaml(updated);
  };

  const handleAddItemPrompt = () => {
    const isMetrics = configType === 'metrics';
    if (isMetrics) {
      const key = prompt('Enter new Metric Stat Key (e.g. cpu|swapwait_average):');
      if (!key) return;
      const name = prompt('Enter Display Name:', key);
      const unit = prompt('Enter Unit (e.g. percent, ms, count, KBps):', 'count');
      const desc = prompt('Enter Description (optional):', '');
      const newBlock = `\n      - key: "${key}"\n        name: "${name || key}"\n        unit: "${unit || 'count'}"\n        description: "${desc || ''}"`;
      const lines = metricsYaml.split(/\r?\n/);
      let inserted = false;
      let newLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        newLines.push(lines[i]);
        if (!inserted && lines[i].match(new RegExp('^\\s*' + activeKind + ':'))) {
          newLines.push(newBlock);
          inserted = true;
        }
      }
      if (!inserted) newLines.push(`\n  ${activeKind}:\n${newBlock}`);
      setMetricsYaml(newLines.join('\n'));
    } else {
      const subType = prompt('Enter Alert Sub-Type (e.g. HARDWARE, CAPACITY, NETWORK):');
      if (!subType) return;
      const name = prompt('Enter Alert Name Filter:', `${subType} High Severity Event`);
      const minSev = prompt('Enter Min Severity (WARNING, CRITICAL, IMMEDIATE):', 'WARNING');
      const desc = prompt('Enter Description (optional):', '');
      const newBlock = `\n      - alert_sub_type: "${subType}"\n        name: "${name || subType}"\n        min_severity: "${minSev || 'WARNING'}"\n        description: "${desc || ''}"`;
      const lines = alertsYaml.split(/\r?\n/);
      let inserted = false;
      let newLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        newLines.push(lines[i]);
        if (!inserted && lines[i].match(new RegExp('^\\s*' + activeKind + ':'))) {
          newLines.push(newBlock);
          inserted = true;
        }
      }
      if (!inserted) newLines.push(`\n  ${activeKind}:\n${newBlock}`);
      setAlertsYaml(newLines.join('\n'));
    }
  };

  const activeYaml = configType === 'metrics' ? metricsYaml : alertsYaml;
  const parsedConfig = parseYamlConfig(activeYaml);
  const kindData = parsedConfig.object_types?.[activeKind] || { metrics: [], alert_filters: [] };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>System & VCF Instance Configuration</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Manage connected VCF Operations 9 instances, authentication methods, telemetry rules, and retention policies</p>
      </div>

      {/* Live System Ingestion Health Banner */}
      <div style={{ background: '#0f172a', padding: '12px 16px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #334155' }}>
        <span className="badge badge-healthy">🟢 Ingestion Engine Online</span>
        <span style={{ color: '#94a3b8' }}>Connected to 5 VCF Operations 9 instances. Last 1-minute delta poll completed 8s ago.</span>
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

      {/* Telemetry Collection Configuration Rules Panel */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>⚙️ Telemetry Collection Rules (Metrics & Alerts)</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
              Dynamically configure metrics and alert filters collected per object type (<code>metrics_list.yaml</code> / <code>alerts_list.yaml</code>).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className={configMode === 'grid' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px' }} onClick={() => setConfigMode('grid')}>Structured Grid</button>
            <button className={configMode === 'yaml' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '12px' }} onClick={() => setConfigMode('yaml')}>📝 Raw YAML</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <button className={configType === 'metrics' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '13px' }} onClick={() => setConfigType('metrics')}>📊 Metrics Rules (metrics_list.yaml)</button>
          <button className={configType === 'alerts' ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '13px' }} onClick={() => setConfigType('alerts')}>🚨 Alert Rules (alerts_list.yaml)</button>
        </div>

        <div style={{ background: '#0f172a', padding: '16px', borderRadius: '6px', border: '1px solid #334155' }}>
          {configMode === 'yaml' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>📝 Direct YAML Editor (<code>Configuration/{configType === 'metrics' ? 'metrics_list.yaml' : 'alerts_list.yaml'}</code>):</div>
              <textarea
                rows={14}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '12px', borderRadius: '6px', lineHeight: '1.4' }}
                value={configType === 'metrics' ? metricsYaml : alertsYaml}
                onChange={(e) => configType === 'metrics' ? setMetricsYaml(e.target.value) : setAlertsYaml(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
                {(['VirtualMachine', 'HostSystem', 'ClusterComputeResource', 'Datastore'] as const).map(kind => (
                  <button
                    key={kind}
                    className={activeKind === kind ? 'btn-primary' : 'btn-secondary'}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => setActiveKind(kind)}
                  >
                    {kind}
                  </button>
                ))}
              </div>

              {configType === 'metrics' ? (
                <div>
                  <table>
                    <thead>
                      <tr><th>Stat Key</th><th>Display Name</th><th>Unit</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {kindData.metrics.length === 0 ? (
                        <tr><td colSpan={5} style={{ color: '#94a3b8', textAlign: 'center' }}>No metric keys defined for {activeKind}</td></tr>
                      ) : (
                        kindData.metrics.map(m => (
                          <tr key={m.key}>
                            <td><code>{m.key}</code></td>
                            <td>{m.name || m.key}</td>
                            <td>{m.unit || 'count'}</td>
                            <td>
                              <span className={`badge ${m.active ? 'badge-healthy' : 'badge-warning'}`}>
                                {m.active ? 'ACTIVE' : 'DISABLED'}
                              </span>
                            </td>
                            <td>
                              <button className="btn-secondary" style={{ fontSize: '11px', padding: '2px 6px' }} onClick={() => handleToggleItem(m.key)}>
                                {m.active ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <button className="btn-secondary" style={{ fontSize: '12px', marginTop: '12px' }} onClick={handleAddItemPrompt}>
                    + Add Metric Key to {activeKind}
                  </button>
                </div>
              ) : (
                <div>
                  <table>
                    <thead>
                      <tr><th>Alert Sub-Type</th><th>Alert Name Filter</th><th>Min Severity</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {kindData.alert_filters.length === 0 ? (
                        <tr><td colSpan={5} style={{ color: '#94a3b8', textAlign: 'center' }}>No alert filters defined for {activeKind}</td></tr>
                      ) : (
                        kindData.alert_filters.map(a => (
                          <tr key={a.alert_sub_type}>
                            <td><code>{a.alert_sub_type}</code></td>
                            <td>{a.name || a.alert_sub_type}</td>
                            <td>
                              <span className={`badge ${(a.min_severity === 'CRITICAL' || a.min_severity === 'IMMEDIATE') ? 'badge-critical' : 'badge-warning'}`}>
                                {a.min_severity || 'WARNING'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${a.active ? 'badge-healthy' : 'badge-warning'}`}>
                                {a.active ? 'ACTIVE' : 'DISABLED'}
                              </span>
                            </td>
                            <td>
                              <button className="btn-secondary" style={{ fontSize: '11px', padding: '2px 6px' }} onClick={() => handleToggleItem(a.alert_sub_type)}>
                                {a.active ? 'Disable' : 'Enable'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <button className="btn-secondary" style={{ fontSize: '12px', marginTop: '12px' }} onClick={handleAddItemPrompt}>
                    + Add Alert Filter to {activeKind}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {configSaveStatus ? (
            <div style={{ fontSize: '13px', color: '#6ee7b7', fontWeight: 600 }}>✅ {configSaveStatus}</div>
          ) : <div />}
          <button className="btn-primary" onClick={handleSaveTelemetryConfig}>💾 Save & Apply Dynamic Telemetry Rules</button>
        </div>
      </div>

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
