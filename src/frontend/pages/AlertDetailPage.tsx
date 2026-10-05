import React from 'react';
import { ConsoleLink } from '../components/ConsoleLink';
import { MetricCharts, type MetricKey } from '../components/MetricCharts';
import { formatUtc, useApi, type PageProps } from '../api';
import { severityBadge } from './AlertsPage';

interface AlertDetailPageProps extends PageProps {
  alertId: string;
}

const HOUR_MS = 60 * 60 * 1000;

const OPERATOR_SYMBOLS: Record<string, string> = { GT: '>', GT_EQ: '≥', LT: '<', LT_EQ: '≤', EQ: '=', NOT_EQ: '≠' };

export const AlertDetailPage: React.FC<AlertDetailPageProps> = ({ alertId, onNavigate }) => {
  const alertReq = useApi<any>(`/alerts/${encodeURIComponent(alertId)}`);
  const alert = alertReq.data;
  const keysReq = useApi<MetricKey[]>(alert ? `/metrics/keys?resourceUuid=${encodeURIComponent(alert.resourceUuid)}&instanceId=${encodeURIComponent(alert.instanceId)}` : null);
  const keys = Array.isArray(keysReq.data) ? keysReq.data : [];

  // Stat keys named by the alert's symptom conditions. They are charted live from the source
  // instance, so they appear even when they are not part of the scheduled collection.
  const conditions: any[] = alert?.conditions || [];
  const triggeringKeys: MetricKey[] = Array.from(new Set(conditions.map(c => c.statKey))).map(statKey => {
    const collected = keys.find(k => k.statKey === statKey);
    return { statKey, name: collected?.name || statKey, unit: collected?.unit || '' };
  });

  const backButton = (
    <button className="btn-secondary" style={{ marginBottom: '12px', fontSize: '13px' }} onClick={() => onNavigate('/alerts')}>
      ⬅️ Back to Alerts Analysis
    </button>
  );

  if (alertReq.error) {
    return (
      <div style={{ padding: '24px' }}>
        {backButton}
        <div className="panel" style={{ color: '#fca5a5' }}>⚠️ {alertReq.error}</div>
      </div>
    );
  }
  if (!alert) {
    return <div style={{ padding: '24px', color: '#94a3b8' }}>Loading alert…</div>;
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        {backButton}
        <h1 style={{ fontSize: '20px', fontWeight: 800 }}>ALERT DETAILS: {alert.alertName}</h1>
      </div>

      {/* Properties & Context Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>ALERT PROPERTIES</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>Alert ID:</strong> <code>{alert.alertId}</code></div>
            <div><strong>Severity:</strong> <span className={`badge ${severityBadge(alert.severity)}`}>{alert.severity}</span></div>
            <div><strong>Status:</strong> <span className={`badge ${alert.status === 'ACTIVE' ? 'badge-warning' : 'badge-healthy'}`}>{alert.status}</span></div>
            <div><strong>Trigger Time:</strong> {formatUtc(alert.startTime)}</div>
            <div><strong>Last Update:</strong> {formatUtc(alert.updateTime)}</div>
            {alert.cancelTime && <div><strong>Cancel Time:</strong> {formatUtc(alert.cancelTime)}</div>}
            {conditions.length === 0 ? (
              <div><strong>Triggering Condition:</strong> <span style={{ color: '#94a3b8' }}>none reported by the source (event or fault based alert)</span></div>
            ) : conditions.map(c => (
              <div key={`${c.statKey}/${c.operator}/${c.threshold}`} data-testid="alert-condition">
                <strong>Triggering Stat Key:</strong> <code>{c.statKey}</code> {OPERATOR_SYMBOLS[c.operator] || c.operator} {c.threshold}{' '}
                <span className={`badge ${severityBadge(c.severity)}`}>{c.severity}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>IMPACTED RESOURCE CONTEXT</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div><strong>Resource Name:</strong> <strong style={{ cursor: 'pointer', color: '#3b82f6' }} onClick={() => onNavigate(`/objects/${encodeURIComponent(alert.resourceUuid)}`)}>{alert.resourceName}</strong></div>
            <div><strong>Resource Kind:</strong> {alert.resourceKind || 'Not in the collected inventory'}</div>
            <div><strong>Adapter Type:</strong> {alert.adapterKind || '—'}</div>
            <div><strong>VCF Instance:</strong> {alert.instanceName || alert.instanceId} {alert.instanceHostname && <code>{alert.instanceHostname}</code>}</div>
          </div>
        </div>
      </div>

      {/* The metric(s) that triggered the alert, read live from the source instance */}
      {triggeringKeys.length > 0 && (
        <div data-testid="triggering-metric">
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Triggering Metric Timeseries Overlay</h3>
          <MetricCharts
            live
            resourceUuid={alert.resourceUuid}
            instanceId={alert.instanceId}
            keys={triggeringKeys}
            resolution="1m"
            startTime={alert.startTime - HOUR_MS}
            endTime={alert.cancelTime ? alert.cancelTime + HOUR_MS : undefined}
            markerTimestamp={alert.startTime}
            markerLabel="Alert triggered"
          />
        </div>
      )}

      {/* Metrics of the impacted resource around the trigger time */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Resource Metrics Around the Trigger Time</h3>
        {keys.length === 0 ? (
          <div className="panel" style={{ color: '#94a3b8', fontSize: '13px' }}>No metric samples have been collected for this resource.</div>
        ) : (
          <MetricCharts
            resourceUuid={alert.resourceUuid}
            instanceId={alert.instanceId}
            keys={keys}
            resolution="1m"
            startTime={alert.startTime - HOUR_MS}
            endTime={alert.cancelTime ? alert.cancelTime + HOUR_MS : undefined}
            markerTimestamp={alert.startTime}
            markerLabel="Alert triggered"
          />
        )}
      </div>

      <ConsoleLink
        instanceId={alert.instanceId}
        resourceUuid={alert.resourceUuid}
        alertId={alert.alertId}
        label="Open Alert in VCF Operations Console"
        description="Need deep troubleshooting in the source environment?"
      />
    </div>
  );
};
