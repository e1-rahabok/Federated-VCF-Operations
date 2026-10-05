import React, { useEffect, useState } from 'react';
import { useApi } from '../api';
import { TimeSeriesChart, type ChartPoint, type ChartSeries } from './TimeSeriesChart';

export interface MetricKey {
  statKey: string;
  name: string;
  unit: string;
  sampleCount?: number;
  lastTimestamp?: number;
}

interface MetricChartsProps {
  resourceUuid: string;
  instanceId?: string;
  keys: MetricKey[];
  resolution: '1m' | '5m' | '1h';
  startTime: number;
  endTime?: number;
  markerTimestamp?: number;
  markerLabel?: string;
  // true: read the samples straight from the source VCF Operations instance instead of SQLite.
  live?: boolean;
  // Reports the points currently visible (after zoom) so the page can compute statistics/exports.
  onVisiblePoints?: (points: ChartPoint[]) => void;
}

/**
 * Queries /metrics/query for one resource and draws its stat keys. Keys are grouped by
 * unit, two units per chart (left and right Y-axis). All charts share one zoom window.
 */
export const MetricCharts: React.FC<MetricChartsProps> = ({ resourceUuid, instanceId, keys, resolution, startTime, endTime, markerTimestamp, markerLabel, live, onVisiblePoints }) => {
  const [zoom, setZoom] = useState<[number, number] | null>(null);

  const statKeys = keys.map(k => k.statKey).join(',');
  const path = keys.length === 0 ? null :
    `/metrics/${live ? 'live' : 'query'}?resourceUuid=${encodeURIComponent(resourceUuid)}&statKeys=${encodeURIComponent(statKeys)}&resolution=${resolution}&startTime=${startTime}` +
    (endTime ? `&endTime=${endTime}` : '') +
    (instanceId && instanceId !== 'ALL' ? `&instanceId=${encodeURIComponent(instanceId)}` : '');
  const { data, error, loading } = useApi<ChartPoint[]>(path);
  const points = Array.isArray(data) ? data : [];

  useEffect(() => { setZoom(null); }, [path]);

  useEffect(() => {
    if (!onVisiblePoints) return;
    onVisiblePoints(zoom ? points.filter(p => p.timestamp >= zoom[0] && p.timestamp <= zoom[1]) : points);
  }, [data, zoom]);

  if (keys.length === 0) {
    return <div className="panel" style={{ color: '#94a3b8', fontSize: '13px' }}>No metrics selected.</div>;
  }
  if (error) {
    return <div className="panel" style={{ color: '#fca5a5', fontSize: '13px' }}>⚠️ Could not load metrics: {error}</div>;
  }
  if (loading && points.length === 0) {
    return <div className="panel" style={{ color: '#94a3b8', fontSize: '13px' }}>Loading metrics…</div>;
  }

  const units = Array.from(new Set(keys.map(k => k.unit)));
  const charts: ChartSeries[][] = [];
  for (let i = 0; i < units.length; i += 2) {
    charts.push(keys
      .filter(k => k.unit === units[i] || k.unit === units[i + 1])
      .map(k => ({ key: k.statKey, label: k.name, unit: k.unit, axis: k.unit === units[i] ? 'left' as const : 'right' as const })));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {charts.map(series => (
        <div className="panel" key={series.map(s => s.key).join(',')}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}>{series.map(s => s.label).join(' vs ')}</h3>
          <TimeSeriesChart points={points} series={series} zoom={zoom} onZoom={setZoom} markerTimestamp={markerTimestamp} markerLabel={markerLabel} />
        </div>
      ))}
      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
        {points.length} time points {live ? 'read live from the source instance' : 'loaded'} · hover for values · drag across a chart to zoom
      </div>
    </div>
  );
};
