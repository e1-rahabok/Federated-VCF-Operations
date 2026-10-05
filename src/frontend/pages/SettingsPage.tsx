import React, { useState, useEffect } from 'react';
import { parseYamlConfig } from '../../shared/telemetryConfig';
import { apiDelete, apiGet, apiPost, apiPut, formatUtc, useApi } from '../api';

const EMPTY_INSTANCE_FORM = {
  name: '',
  hostname: '',
  authType: 'OPS_TOKEN' as 'OPS_TOKEN' | 'BEARER_TOKEN',
  username: '',
  password: '',
  authSource: 'LOCAL',
  vidbHost: '',
  clientId: '',
  apiToken: '',
  verifyTls: true
};

export const SettingsPage: React.FC = () => {
  const instancesReq = useApi<any[]>('/instances');
  const statusReq = useApi<any>('/system/status');
  const instances = Array.isArray(instancesReq.data) ? instancesReq.data : [];
  const status = statusReq.data;

  const [showAddModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_INSTANCE_FORM });
  const [testStatus, setTestStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [instanceMessage, setInstanceMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Telemetry Config State
  const [configType, setConfigType] = useState<'metrics' | 'alerts'>('metrics');
  const [configMode, setConfigMode] = useState<'grid' | 'yaml'>('grid');
  const [activeKind, setActiveKind] = useState<'VirtualMachine' | 'HostSystem' | 'ClusterComputeResource' | 'Datastore'>('VirtualMachine');
  const [metricsYaml, setMetricsYaml] = useState('');
  const [alertsYaml, setAlertsYaml] = useState('');
  const [configSaveStatus, setConfigSaveStatus] = useState<{ ok: boolean; text: string } | null>(null);

  // Retention form, initialised from the values currently in force
  const [rawRetentionHours, setRawRetentionHours] = useState('');
  const [summaryRetentionDays, setSummaryRetentionDays] = useState('');
  const [retentionStatus, setRetentionStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (status?.retention && rawRetentionHours === '' && summaryRetentionDays === '') {
      setRawRetentionHours(String(status.retention.rawHours));
      setSummaryRetentionDays(String(status.retention.summaryDays));
    }
  }, [status]);

  const handleSaveRetention = async () => {
    try {
      const saved = await apiPut('/system/settings/retention', { rawHours: Number(rawRetentionHours), summaryDays: Number(summaryRetentionDays) });
      setRetentionStatus({ ok: true, text: `Retention saved: raw samples ${saved.retention.rawHours} hours, summary rollups ${saved.retention.summaryDays} days. Applied by the next purge run.` });
      statusReq.reload();
    } catch (err: any) {
      setRetentionStatus({ ok: false, text: err.message });
    }
  };

  useEffect(() => {
    apiGet('/system/config/metrics')
      .then(d => { if (d.success) setMetricsYaml(d.yaml); })
      .catch(err => setConfigSaveStatus({ ok: false, text: `Could not load metrics_list.yaml: ${err.message}` }));

    apiGet('/system/config/alerts')
      .then(d => { if (d.success) setAlertsYaml(d.yaml); })
      .catch(err => setConfigSaveStatus({ ok: false, text: `Could not load alerts_list.yaml: ${err.message}` }));
  }, []);

  const setField = (field: keyof typeof EMPTY_INSTANCE_FORM, value: any) => {
    setForm(current => ({ ...current, [field]: value }));
  };

  const handleTestConnection = async () => {
    setTestStatus({ message: 'Testing REST API connection...' });
    try {
      setTestStatus(await apiPost('/instances/test', form));
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message });
    }
  };

  const handleSaveInstance = async () => {
    try {
      const saved = await apiPost('/instances', form);
      setShowModal(false);
      setForm({ ...EMPTY_INSTANCE_FORM });
      setTestStatus(null);
      setInstanceMessage({ ok: true, text: saved.message });
      instancesReq.reload();
      statusReq.reload();
    } catch (err: any) {
      setTestStatus({ success: false, message: err.message });
    }
  };

  const handleDeleteInstance = async (id: string, name: string) => {
    try {
      await apiDelete(`/instances/${encodeURIComponent(id)}`);
      setInstanceMessage({ ok: true, text: `Instance ${name} and its collected data were deleted.` });
      instancesReq.reload();
      statusReq.reload();
    } catch (err: any) {
      setInstanceMessage({ ok: false, text: `Could not delete ${name}: ${err.message}` });
    }
  };

  const handleSaveTelemetryConfig = async () => {
    const isMetrics = configType === 'metrics';
    try {
      const data = await apiPut(`/system/config/${isMetrics ? 'metrics' : 'alerts'}`, { yaml: isMetrics ? metricsYaml : alertsYaml });
      setConfigSaveStatus({ ok: true, text: data.message });
    } catch (err: any) {
      setConfigSaveStatus({ ok: false, text: `Error saving configuration: ${err.message}` });
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
      if (cleanLine.startsWith('- property_key:')) {
        inTargetItem = false;
      }
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
  const kindData = parsedConfig.object_types?.[activeKind] || { metrics: [], properties: [], alert_filters: [] };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800 }}>System & VCF Instance Configuration</h1>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Manage connected VCF Operations 9 instances, authentication methods, telemetry rules, and retention policies</p>
      </div>

      {/* Live System Ingestion Health Banner */}
      <div data-testid="ingestion-banner" style={{ background: '#0f172a', padding: '12px 16px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #334155' }}>
        {!status ? (
          <span style={{ color: '#94a3b8' }}>{statusReq.error ? `⚠️ Status unavailable: ${statusReq.error}` : 'Loading ingestion status…'}</span>
        ) : (
          <>
            <span className={`badge ${status.instances.enabled > 0 && status.instances.healthy === status.instances.enabled ? 'badge-healthy' : 'badge-warning'}`}>
              {status.instances.healthy} of {status.instances.enabled} instances healthy
            </span>
            <span style={{ color: '#94a3b8' }}>
              Polling every {status.pollingIntervalSeconds}s. Last successful poll: {formatUtc(status.lastPoll)}. {status.objects} objects tracked, {status.rawSamples} raw samples stored.
            </span>
          </>
        )}
      </div>

      {instanceMessage && (
        <div style={{ background: instanceMessage.ok ? '#064e3b' : '#7f1d1d', color: instanceMessage.ok ? '#6ee7b7' : '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
          {instanceMessage.ok ? '✅' : '⚠️'} {instanceMessage.text}
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
              <th>TLS Validation</th>
              <th>Last Poll</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {instances.length === 0 && !instancesReq.loading && (
              <tr><td colSpan={7} style={{ color: '#94a3b8', textAlign: 'center' }}>No VCF Operations instances registered.</td></tr>
            )}
            {instances.map(inst => (
              <tr key={inst.id} data-testid="instance-row">
                <td><strong>{inst.name}</strong></td>
                <td><code>{inst.hostname}</code></td>
                <td>{inst.authType === 'OPS_TOKEN' ? 'Option A: OpsToken (Local)' : 'Option B: Bearer Token (VCF SSO)'}</td>
                <td>{inst.verifyTls ? 'Enabled' : 'Disabled'}</td>
                <td>{formatUtc(inst.lastPoll)}</td>
                <td>
                  <span className={`badge ${inst.status === 'HEALTHY' ? 'badge-healthy' : inst.status === 'ERROR' ? 'badge-critical' : 'badge-info'}`}>{inst.status}</span>
                  {inst.lastError && <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>{inst.lastError}</div>}
                </td>
                <td><button className="btn-secondary" style={{ fontSize: '12px', color: '#fca5a5' }} onClick={() => handleDeleteInstance(inst.id, inst.name)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Instance Connection form */}
      {showAddModal && (
        <div className="panel" style={{ border: '2px solid #3b82f6', background: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Add VCF Instance Connection</h3>
            <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={() => setShowModal(false)}>✕ Close</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label htmlFor="inst-name" style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Instance Name</label>
                <input id="inst-name" type="text" style={{ width: '100%' }} value={form.name} onChange={(e) => setField('name', e.target.value)} />
              </div>
              <div>
                <label htmlFor="inst-hostname" style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Hostname / IP Address</label>
                <input id="inst-hostname" type="text" style={{ width: '100%' }} value={form.hostname} onChange={(e) => setField('hostname', e.target.value)} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '8px' }}>Select Authentication Method:</label>
              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="radio" name="auth" checked={form.authType === 'OPS_TOKEN'} onChange={() => setField('authType', 'OPS_TOKEN')} />
                  <span>Option A: Local Credentials (OpsToken)</span>
                </label>
                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="radio" name="auth" checked={form.authType === 'BEARER_TOKEN'} onChange={() => setField('authType', 'BEARER_TOKEN')} />
                  <span>Option B: VCF SSO API Token (Bearer) - VCF 9.1+</span>
                </label>
              </div>
            </div>

            {form.authType === 'OPS_TOKEN' ? (
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" aria-label="Username" placeholder="Username" style={{ width: '100%' }} value={form.username} onChange={(e) => setField('username', e.target.value)} />
                <input type="password" aria-label="Password" placeholder="Password" style={{ width: '100%' }} value={form.password} onChange={(e) => setField('password', e.target.value)} />
                <input type="text" aria-label="Auth Source" placeholder="Auth Source (e.g. LOCAL)" style={{ width: '100%' }} value={form.authSource} onChange={(e) => setField('authSource', e.target.value)} />
              </div>
            ) : (
              <div style={{ background: '#1e293b', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" aria-label="Identity Broker Host" placeholder="VCF Identity Broker FQDN" style={{ width: '100%' }} value={form.vidbHost} onChange={(e) => setField('vidbHost', e.target.value)} />
                <input type="text" aria-label="Identity Broker Tenant" placeholder="Identity Broker tenant (default: CUSTOMER)" style={{ width: '100%' }} value={form.clientId} onChange={(e) => setField('clientId', e.target.value)} />
                <input type="password" aria-label="API Token" placeholder="VCF SSO API Token" style={{ width: '100%' }} value={form.apiToken} onChange={(e) => setField('apiToken', e.target.value)} />
              </div>
            )}

            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <input type="checkbox" checked={form.verifyTls} onChange={(e) => setField('verifyTls', e.target.checked)} />
              <span>Validate the TLS certificate of this instance</span>
            </label>

            {testStatus && (
              <div data-testid="test-status" style={{ background: testStatus.success ? '#064e3b' : testStatus.success === false ? '#7f1d1d' : '#1e3a8a', color: testStatus.success ? '#6ee7b7' : testStatus.success === false ? '#fca5a5' : '#93c5fd', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                {testStatus.message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
              <button className="btn-secondary" onClick={handleTestConnection}>🧪 Test Connection</button>
              <button className="btn-primary" onClick={handleSaveInstance}>💾 Save Instance</button>
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
            <div style={{ fontSize: '13px', color: configSaveStatus.ok ? '#6ee7b7' : '#fca5a5', fontWeight: 600 }}>{configSaveStatus.ok ? '✅' : '⚠️'} {configSaveStatus.text}</div>
          ) : <div />}
          <button className="btn-primary" onClick={handleSaveTelemetryConfig}>💾 Save & Apply Dynamic Telemetry Rules</button>
        </div>
      </div>

      {/* Retention Settings Panel */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Data Retention & Pruning Policies</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label htmlFor="retention-raw" style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Raw Metrics Buffer Retention (Hours)</label>
            <input id="retention-raw" type="number" style={{ width: '100%' }} min={status?.retentionLimits.rawHours.min} max={status?.retentionLimits.rawHours.max} value={rawRetentionHours} onChange={(e) => setRawRetentionHours(e.target.value)} />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              In force: <span data-testid="retention-raw-current">{status ? `${status.retention.rawHours} hours` : '—'}</span> · {status?.rawSamples ?? 0} raw samples stored
            </div>
          </div>

          <div>
            <label htmlFor="retention-summary" style={{ fontSize: '13px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Summary Rollup Retention (Days)</label>
            <input id="retention-summary" type="number" style={{ width: '100%' }} min={status?.retentionLimits.summaryDays.min} max={status?.retentionLimits.summaryDays.max} value={summaryRetentionDays} onChange={(e) => setSummaryRetentionDays(e.target.value)} />
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
              In force: <span data-testid="retention-summary-current">{status ? `${status.retention.summaryDays} days` : '—'}</span> · {status?.summaryRows ?? 0} summary rows stored
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {retentionStatus ? (
            <div data-testid="retention-status" style={{ fontSize: '13px', color: retentionStatus.ok ? '#6ee7b7' : '#fca5a5', fontWeight: 600 }}>{retentionStatus.ok ? '✅' : '⚠️'} {retentionStatus.text}</div>
          ) : <div />}
          <button className="btn-primary" onClick={handleSaveRetention}>💾 Save Retention Policies</button>
        </div>
      </div>
    </div>
  );
};
