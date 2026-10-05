import React, { useMemo, useState } from 'react';
import { ConsoleLink } from '../components/ConsoleLink';
import { MetricCharts, type MetricKey } from '../components/MetricCharts';
import { apiGet, apiPut, formatUtc, formatValue, rangeToMs, useApi, type PageProps } from '../api';
import { severityBadge } from './AlertsPage';

interface ObjectDetailPageProps extends PageProps {
  resourceUuid: string;
}

export const ObjectDetailPage: React.FC<ObjectDetailPageProps> = ({ resourceUuid, onNavigate, timeRange }) => {
  const objectReq = useApi<any>(`/objects/${encodeURIComponent(resourceUuid)}`);
  const object = objectReq.data;
  const alertsReq = useApi<any[]>(object ? `/alerts?status=ACTIVE&resourceUuid=${encodeURIComponent(resourceUuid)}&instanceId=${encodeURIComponent(object.instanceId)}` : null);
  const keysReq = useApi<MetricKey[]>(object ? `/metrics/keys?resourceUuid=${encodeURIComponent(resourceUuid)}&instanceId=${encodeURIComponent(object.instanceId)}` : null);
  const [pinError, setPinError] = useState<string | null>(null);

  const startTime = useMemo(() => Date.now() - rangeToMs(timeRange), [timeRange]);
  const alerts = Array.isArray(alertsReq.data) ? alertsReq.data : [];
  const keys = Array.isArray(keysReq.data) ? keysReq.data : [];

  const backButton = (
    <button className="btn-secondary" style={{ marginBottom: '12px', fontSize: '13px' }} onClick={() => onNavigate('/metrics')}>
      ⬅️ Back to Metrics Analysis
    </button>
  );

  if (objectReq.error) {
    return (
      <div style={{ padding: '24px' }}>
        {backButton}
        <div className="panel" style={{ color: '#fca5a5' }}>⚠️ {objectReq.error}</div>
      </div>
    );
  }
  if (!object) {
    return <div style={{ padding: '24px', color: '#94a3b8' }}>Loading object…</div>;
  }

  const handleTogglePin = async () => {
    try {
      const prefs = await apiGet('/users/preferences');
      const others = (prefs.pinnedObjects || []).filter((p: any) => !(p.instanceId === object.instanceId && p.resourceUuid === object.resourceUuid));
      const pinnedObjects = object.pinned ? others : [...others, { instanceId: object.instanceId, resourceUuid: object.resourceUuid }];
      await apiPut('/users/preferences', { pinnedObjects });
      setPinError(null);
      objectReq.reload();
    } catch (err: any) {
      setPinError(err.message);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        {backButton}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800 }}>OBJECT DETAIL: {object.resourceKind} - {object.resourceName}</h1>
          <button className={object.pinned ? 'btn-secondary' : 'btn-primary'} onClick={handleTogglePin}>
            {object.pinned ? '📌 Unpin from Home' : '📌 Pin to Home'}
          </button>
        </div>
        {pinError && <div style={{ color: '#fca5a5', fontSize: '13px', marginTop: '8px' }}>⚠️ {pinError}</div>}
      </div>

      {/* Summary Properties & Latest Values Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>OBJECT PROPERTIES SUMMARY</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>VCF Instance:</strong> {object.instanceName || object.instanceId} {object.instanceHostname && <code>{object.instanceHostname}</code>}</div>
            <div><strong>Resource Kind:</strong> {object.resourceKind}</div>
            <div><strong>Adapter Type:</strong> {object.adapterKind}</div>
            <div><strong>Resource UUID:</strong> <code>{object.resourceUuid}</code></div>
            <div><strong>Last Seen:</strong> {formatUtc(object.lastSeen)}</div>
            {(object.properties || []).map((p: any) => (
              <div key={p.key} data-testid="object-property"><strong>{p.name}:</strong> {p.value}</div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>PARENT HIERARCHY BREADCRUMBS</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            {(object.hierarchy || []).length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>No related objects have been collected for this object yet.</div>
            )}
            {(object.hierarchy || []).map((h: any) => (
              <div key={`${h.kind}/${h.uuid}`} data-testid="hierarchy-level">
                <strong>{h.label}:</strong>{' '}
                {h.tracked ? (
                  <a href={`/objects/${encodeURIComponent(h.uuid)}`} onClick={(e) => { e.preventDefault(); onNavigate(`/objects/${encodeURIComponent(h.uuid)}`); }}><code>{h.name}</code></a>
                ) : (
                  <code>{h.name}</code>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>LATEST COLLECTED VALUES</h3>
          {(object.latestMetrics || []).length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>No metric samples have been collected for this object.</div>
          ) : (
            <table>
              <thead><tr><th>Metric</th><th>Value</th><th>Sampled</th></tr></thead>
              <tbody>
                {object.latestMetrics.map((m: any) => {
                  const key = keys.find(k => k.statKey === m.statKey);
                  return (
                    <tr key={m.statKey} data-testid="latest-metric">
                      <td>{key?.name || m.statKey}</td>
                      <td><strong>{formatValue(m.value)}</strong></td>
                      <td>{formatUtc(m.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Active Alerts Bound to this Resource */}
      <div className="panel">
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Active Alerts on this Resource ({alerts.length} Active)</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alerts.length === 0 && <div style={{ color: '#94a3b8', fontSize: '13px' }}>No active alerts.</div>}
          {alerts.map(a => (
            <div key={a.alertId} data-testid="object-alert" style={{ background: '#0f172a', padding: '12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }} onClick={() => onNavigate(`/alerts/${encodeURIComponent(a.alertId)}`)}>
              <span><span className={`badge ${severityBadge(a.severity)}`}>{a.severity}</span> {a.alertName} (triggered {formatUtc(a.startTime)})</span>
              <span>Inspect Alert ➔</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metric charts for every collected stat key */}
      <MetricCharts resourceUuid={object.resourceUuid} instanceId={object.instanceId} keys={keys} resolution="5m" startTime={startTime} />

      <ConsoleLink
        instanceId={object.instanceId}
        resourceUuid={object.resourceUuid}
        label="Open Object in VCF Operations Console"
        description="Want to manage or configure this object directly?"
      />
    </div>
  );
};
