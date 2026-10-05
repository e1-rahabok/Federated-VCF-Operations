import React, { useEffect, useState } from 'react';
import { StatCard } from '../components/StatCard';
import { apiPut, formatUtc, formatValue, instanceQuery, useApi, type PageProps } from '../api';

const WIDGETS = [
  { id: 'ACTIVE_ALERTS', title: 'Active Alerts Summary' },
  { id: 'PINNED_OBJECTS', title: 'Pinned Infrastructure Objects' },
  { id: 'INGESTION_STATUS', title: 'VCF Operations Ingestion Status' },
  { id: 'QUICK_LAUNCHER', title: 'Quick Metrics Launcher' }
];

// Each launcher ranks the objects of one kind by the latest collected value of one stat key.
const LAUNCHERS = [
  { id: 'vm-cpu-ready', title: '⚡ Top 10 VM CPU Ready', kind: 'VirtualMachine', statKey: 'cpu|ready_summation' },
  { id: 'host-cpu', title: '📊 Host CPU Utilization Comparison', kind: 'HostSystem', statKey: 'cpu|usage_average' },
  { id: 'datastore-usage', title: '💾 Datastore Capacity Usage', kind: 'Datastore', statKey: 'diskspace|usage_capacity_pct' }
];

const UNIT_SUFFIX: Record<string, string> = { percent: '%', milliseconds: ' ms' };

const LauncherCard: React.FC<{ launcher: typeof LAUNCHERS[number]; scope: string; onNavigate: (path: string) => void }> = ({ launcher, scope, onNavigate }) => {
  const { data, error } = useApi<any>(`/metrics/top?kind=${launcher.kind}&statKey=${encodeURIComponent(launcher.statKey)}&limit=10${scope ? `&${scope}` : ''}`);
  const resources: any[] = data?.resources || [];
  const suffix = UNIT_SUFFIX[data?.unit] ?? (data?.unit ? ` ${data.unit}` : '');

  return (
    <div data-testid={`launcher-${launcher.id}`} style={{ flex: 1, minWidth: '260px', background: '#0f172a', padding: '12px', borderRadius: '6px' }}>
      <div style={{ fontWeight: 700, fontSize: '14px' }}>{launcher.title}</div>
      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{data?.name || launcher.statKey} · latest sample per object</div>
      {error && <div style={{ fontSize: '12px', color: '#fca5a5' }}>⚠️ {error}</div>}
      {data && resources.length === 0 && (
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {data.collected ? 'No samples collected yet.' : <>Not collected: <code>{launcher.statKey}</code> is not active for {launcher.kind} in metrics_list.yaml.</>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
        {resources.map((r, index) => (
          <div key={`${r.instanceId}/${r.resourceUuid}`} data-testid="launcher-row" style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => onNavigate(`/objects/${encodeURIComponent(r.resourceUuid)}`)}>
            <span>{index + 1}. {r.resourceName}</span>
            <strong>{formatValue(r.value)}{suffix}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const SEVERITY_ORDER = ['CRITICAL', 'IMMEDIATE', 'WARNING', 'INFO'];
const SEVERITY_TILES = [
  { key: 'critical', label: 'CRITICAL', background: '#7f1d1d', color: '#fca5a5' },
  { key: 'immediate', label: 'IMMEDIATE', background: '#7c2d12', color: '#fdba74' },
  { key: 'warning', label: 'WARNING', background: '#78350f', color: '#fcd34d' },
  { key: 'info', label: 'INFO', background: '#1e3a8a', color: '#93c5fd' }
];

export const HomePage: React.FC<PageProps> = ({ onNavigate, instanceId }) => {
  const scope = instanceQuery(instanceId);
  const withScope = (path: string) => scope ? `${path}${path.includes('?') ? '&' : '?'}${scope}` : path;

  const instances = useApi<any[]>('/instances');
  const status = useApi<any>('/system/status');
  const alertSummary = useApi<any>(withScope('/alerts/summary'));
  const activeAlerts = useApi<any[]>(withScope('/alerts?status=ACTIVE'));
  const objectSummary = useApi<any>(withScope('/objects/summary'));
  const pinned = useApi<any[]>('/objects/pinned');
  const preferences = useApi<any>('/users/preferences');

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (preferences.data) setHiddenWidgets(preferences.data.hiddenWidgets || []);
  }, [preferences.data]);

  const toggleWidget = (id: string) => {
    setHiddenWidgets(current => current.includes(id) ? current.filter(w => w !== id) : [...current, id]);
  };

  const handleSavePreferences = async () => {
    try {
      const saved = await apiPut('/users/preferences', { hiddenWidgets });
      setHiddenWidgets(saved.hiddenWidgets);
      setIsCustomizing(false);
      setSaveMessage({ ok: true, text: 'Dashboard layout preferences saved.' });
    } catch (err: any) {
      setSaveMessage({ ok: false, text: `Could not save layout: ${err.message}` });
    }
  };

  const summary = alertSummary.data || {};
  const instanceList = Array.isArray(instances.data) ? instances.data : [];
  const scopedInstances = instanceId === 'ALL' ? instanceList : instanceList.filter(i => i.id === instanceId);
  const alerts = Array.isArray(activeAlerts.data) ? activeAlerts.data : [];
  const topAlert = [...alerts].sort((a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.startTime - a.startTime)[0];
  const pinnedObjects = Array.isArray(pinned.data) ? pinned.data : [];
  const isVisible = (id: string) => isCustomizing || !hiddenWidgets.includes(id);
  const widgetStyle = (id: string): React.CSSProperties => ({
    border: isCustomizing ? '2px dashed #3b82f6' : '1px solid #334155',
    opacity: hiddenWidgets.includes(id) ? 0.45 : 1
  });
  const widgetToggle = (id: string) => isCustomizing && (
    <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => toggleWidget(id)}>
      {hiddenWidgets.includes(id) ? 'Show widget' : 'Hide widget'}
    </button>
  );

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

      {saveMessage && (
        <div style={{ background: saveMessage.ok ? '#064e3b' : '#7f1d1d', color: saveMessage.ok ? '#6ee7b7' : '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '14px' }}>
          {saveMessage.ok ? '✅' : '⚠️'} {saveMessage.text}
        </div>
      )}

      {/* Summary KPI Cards Row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <StatCard label="Monitored VCF Instances" value={scopedInstances.length} subtext={`${scopedInstances.filter(i => i.status === 'HEALTHY').length} healthy`} icon="🌐" accentColor="#3b82f6" />
        <StatCard label="Active Critical Alerts" value={summary.critical ?? 0} subtext={`${alerts.length} active alerts in total`} icon="🚨" accentColor="#ef4444" />
        <StatCard label="Total Monitored Objects" value={objectSummary.data?.total ?? 0} subtext="VMs, ESXi hosts, clusters, datastores" icon="📦" accentColor="#10b981" />
        <StatCard label="Samples Ingested (Last 5 Min)" value={status.data?.samplesLast5Min ?? 0} subtext={`Last poll: ${formatUtc(status.data?.lastPoll)}`} icon="⚡" accentColor="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Widget 1: Active Alerts Summary */}
        {isVisible('ACTIVE_ALERTS') && (
          <div className="panel" data-testid="widget-ACTIVE_ALERTS" style={widgetStyle('ACTIVE_ALERTS')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{WIDGETS[0].title}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {widgetToggle('ACTIVE_ALERTS')}
                <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => onNavigate('/alerts')}>
                  View All Alerts ➔
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              {SEVERITY_TILES.map(tile => (
                <div key={tile.key} data-testid={`alert-count-${tile.key}`} style={{ flex: 1, background: tile.background, padding: '12px', borderRadius: '6px', cursor: 'pointer' }} onClick={() => onNavigate('/alerts')}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: tile.color }}>{summary[tile.key] ?? 0}</div>
                  <div style={{ fontSize: '12px', color: tile.color }}>{tile.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '13px', background: '#0f172a', padding: '10px', borderRadius: '6px' }}>
              {topAlert ? (
                <span style={{ cursor: 'pointer' }} onClick={() => onNavigate(`/alerts/${encodeURIComponent(topAlert.alertId)}`)}>
                  🔥 <strong>Top Alert:</strong> <span style={{ color: '#fca5a5' }}>{topAlert.alertName}</span> on <code>{topAlert.resourceName}</code> ({topAlert.instanceId})
                </span>
              ) : (
                <span style={{ color: '#94a3b8' }}>No active alerts.</span>
              )}
            </div>
          </div>
        )}

        {/* Widget 2: Pinned Infrastructure Objects */}
        {isVisible('PINNED_OBJECTS') && (
          <div className="panel" data-testid="widget-PINNED_OBJECTS" style={widgetStyle('PINNED_OBJECTS')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{WIDGETS[1].title}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {widgetToggle('PINNED_OBJECTS')}
                <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => onNavigate('/metrics')}>
                  Explore Tree ➔
                </button>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Resource Name</th>
                  <th>Kind</th>
                  <th>Instance</th>
                  <th>CPU Usage</th>
                  <th>Active Alerts</th>
                </tr>
              </thead>
              <tbody>
                {pinnedObjects.length === 0 ? (
                  <tr><td colSpan={5} style={{ color: '#94a3b8', textAlign: 'center' }}>No pinned objects. Open an object and choose "Pin to Home".</td></tr>
                ) : pinnedObjects.map(o => {
                  const cpu = (o.latestMetrics || []).find((m: any) => m.statKey === 'cpu|usage_average');
                  return (
                    <tr key={`${o.instanceId}/${o.resourceUuid}`} style={{ cursor: 'pointer' }} onClick={() => onNavigate(`/objects/${encodeURIComponent(o.resourceUuid)}`)}>
                      <td><strong>{o.resourceName}</strong></td>
                      <td>{o.resourceKind}</td>
                      <td>{o.instanceName || o.instanceId}</td>
                      <td>{cpu ? `${formatValue(cpu.value)}%` : '—'}</td>
                      <td><span className={`badge ${o.activeAlerts > 0 ? 'badge-warning' : 'badge-healthy'}`}>{o.activeAlerts}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Widget 3: VCF Ingestion Status */}
        {isVisible('INGESTION_STATUS') && (
          <div className="panel" data-testid="widget-INGESTION_STATUS" style={widgetStyle('INGESTION_STATUS')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{WIDGETS[2].title}</h3>
              {widgetToggle('INGESTION_STATUS')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {scopedInstances.length === 0 && (
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                  No VCF Operations instances registered. <a href="/settings" onClick={(e) => { e.preventDefault(); onNavigate('/settings'); }}>Add one in Settings</a>.
                </div>
              )}
              {scopedInstances.map(inst => (
                <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '12px', borderRadius: '6px' }}>
                  <div>
                    <strong>{inst.name}</strong>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{inst.hostname} | {inst.authType === 'BEARER_TOKEN' ? 'Bearer Token Auth' : 'OpsToken Auth'}</div>
                    {inst.lastError && <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>{inst.lastError}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${inst.status === 'HEALTHY' ? 'badge-healthy' : inst.status === 'ERROR' ? 'badge-critical' : 'badge-info'}`}>{inst.status}</span>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Last poll: {formatUtc(inst.lastPoll)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Widget 4: Quick Metrics Launcher */}
      {isVisible('QUICK_LAUNCHER') && (
        <div className="panel" data-testid="widget-QUICK_LAUNCHER" style={widgetStyle('QUICK_LAUNCHER')}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>🚀 {WIDGETS[3].title}</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {widgetToggle('QUICK_LAUNCHER')}
              <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => onNavigate('/metrics')}>
                Open Metrics Explorer ➔
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {LAUNCHERS.map(launcher => <LauncherCard key={launcher.id} launcher={launcher} scope={scope} onNavigate={onNavigate} />)}
          </div>
        </div>
      )}
    </div>
  );
};
