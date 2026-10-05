import React, { useRef, useState } from 'react';
import { formatValue } from '../api';

export interface ChartSeries {
  key: string;
  label: string;
  unit: string;
  axis: 'left' | 'right';
}

export type ChartPoint = { timestamp: number } & Record<string, number>;

interface TimeSeriesChartProps {
  points: ChartPoint[];
  series: ChartSeries[];
  // Visible time window; null shows everything. Owned by the parent so several charts zoom together.
  zoom: [number, number] | null;
  onZoom: (window: [number, number] | null) => void;
  markerTimestamp?: number;
  markerLabel?: string;
}

const WIDTH = 800;
const HEIGHT = 240;
const PAD = { left: 60, right: 60, top: 20, bottom: 40 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const LEFT_COLORS = ['#3b82f6', '#10b981', '#a78bfa'];
const RIGHT_COLORS = ['#f59e0b', '#ef4444', '#f472b6'];
const GRID_COLOR = '#334155';

function unitSuffix(unit: string): string {
  if (unit === 'percent') return '%';
  if (unit === 'milliseconds') return ' ms';
  return unit ? ` ${unit}` : '';
}

function axisMax(points: ChartPoint[], series: ChartSeries[]): number {
  let max = 0;
  for (const p of points) {
    for (const s of series) {
      if (typeof p[s.key] === 'number' && p[s.key] > max) max = p[s.key];
    }
  }
  if (series.length > 0 && series.every(s => s.unit === 'percent') && max <= 100) return 100;
  if (max <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / magnitude) * magnitude;
}

function utcClock(timestamp: number, withSeconds: boolean = false): string {
  return new Date(timestamp).toISOString().substring(11, withSeconds ? 19 : 16) + ' UTC';
}

/**
 * Dual Y-axis SVG line chart: left axis blue, right axis amber, UTC time axis, hover
 * crosshair with tooltip, and drag-to-zoom.
 */
export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ points, series, zoom, onZoom, markerTimestamp, markerLabel }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<ChartPoint | null>(null);
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);

  const visible = zoom ? points.filter(p => p.timestamp >= zoom[0] && p.timestamp <= zoom[1]) : points;
  if (visible.length === 0) {
    return <div data-testid="chart-empty" style={{ color: '#94a3b8', fontSize: '13px', padding: '24px', textAlign: 'center' }}>No samples in this time window.</div>;
  }

  const tMin = visible[0].timestamp;
  const tMax = visible[visible.length - 1].timestamp;
  const leftSeries = series.filter(s => s.axis === 'left');
  const rightSeries = series.filter(s => s.axis === 'right');
  const leftMax = axisMax(visible, leftSeries);
  const rightMax = axisMax(visible, rightSeries);

  const xOf = (timestamp: number) => tMax === tMin ? PAD.left + PLOT_W / 2 : PAD.left + ((timestamp - tMin) / (tMax - tMin)) * PLOT_W;
  const yOf = (value: number, max: number) => PAD.top + PLOT_H - (Math.max(0, value) / max) * PLOT_H;
  const colorOf = (s: ChartSeries) => s.axis === 'left'
    ? LEFT_COLORS[leftSeries.indexOf(s) % LEFT_COLORS.length]
    : RIGHT_COLORS[rightSeries.indexOf(s) % RIGHT_COLORS.length];

  const pathOf = (s: ChartSeries) => {
    const max = s.axis === 'left' ? leftMax : rightMax;
    let d = '';
    let penDown = false;
    for (const p of visible) {
      if (typeof p[s.key] !== 'number') { penDown = false; continue; }
      d += `${penDown ? ' L' : (d ? ' M' : 'M')} ${xOf(p.timestamp).toFixed(1)} ${yOf(p[s.key], max).toFixed(1)}`;
      penDown = true;
    }
    return d;
  };

  const timestampAt = (clientX: number): number => {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = rect.width > 0 ? ((clientX - rect.left) / rect.width) * WIDTH : PAD.left;
    const ratio = Math.max(0, Math.min(1, (svgX - PAD.left) / PLOT_W));
    return tMin + ratio * (tMax - tMin);
  };
  const nearestPoint = (timestamp: number) =>
    visible.reduce((best, p) => Math.abs(p.timestamp - timestamp) < Math.abs(best.timestamp - timestamp) ? p : best, visible[0]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const t = timestampAt(e.clientX);
    setHover(nearestPoint(t));
    if (drag) setDrag({ start: drag.start, current: t });
  };
  const handleMouseUp = () => {
    if (!drag) return;
    const from = Math.min(drag.start, drag.current);
    const to = Math.max(drag.start, drag.current);
    setDrag(null);
    if (visible.filter(p => p.timestamp >= from && p.timestamp <= to).length >= 2) onZoom([from, to]);
  };
  const handleMouseLeave = () => { setHover(null); setDrag(null); };

  const gridFractions = [0, 0.25, 0.5, 0.75, 1];
  const tickCount = Math.min(6, Math.max(1, visible.length - 1));
  const showMarker = markerTimestamp !== undefined && markerTimestamp >= tMin && markerTimestamp <= tMax;

  return (
    <div style={{ position: 'relative', background: '#0f172a', borderRadius: '6px', border: `1px solid ${GRID_COLOR}`, padding: '8px', userSelect: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: 600, padding: '0 4px 6px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {series.map(s => (
            <span key={s.key} data-testid="chart-legend" style={{ color: colorOf(s) }}>
              ● {s.label} ({s.axis === 'left' ? 'left' : 'right'} axis)
            </span>
          ))}
        </div>
        {zoom && <button className="btn-secondary" style={{ fontSize: '12px', padding: '4px 8px', background: '#78350f', color: '#fcd34d' }} onClick={() => onZoom(null)}>↺ Reset Zoom</button>}
      </div>

      <svg
        ref={svgRef}
        data-testid="timeseries-chart"
        width="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => { const t = timestampAt(e.clientX); setDrag({ start: t, current: t }); }}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {gridFractions.map(f => {
          const y = PAD.top + PLOT_H * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} stroke={GRID_COLOR} strokeDasharray={f === 0 ? undefined : '3 3'} />
              {leftSeries.length > 0 && <text x={PAD.left - 8} y={y + 4} fill="#3b82f6" fontSize="11" textAnchor="end">{formatValue(leftMax * f)}{unitSuffix(leftSeries[0].unit)}</text>}
              {rightSeries.length > 0 && <text x={WIDTH - PAD.right + 8} y={y + 4} fill="#f59e0b" fontSize="11" textAnchor="start">{formatValue(rightMax * f)}{unitSuffix(rightSeries[0].unit)}</text>}
            </g>
          );
        })}
        {leftSeries.length > 0 && <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="#3b82f6" strokeWidth="1.5" />}
        {rightSeries.length > 0 && <line x1={WIDTH - PAD.right} y1={PAD.top} x2={WIDTH - PAD.right} y2={PAD.top + PLOT_H} stroke="#f59e0b" strokeWidth="1.5" />}

        {Array.from({ length: tickCount + 1 }, (_, k) => {
          const t = tMin + (k / tickCount) * (tMax - tMin);
          const x = PAD.left + (k / tickCount) * PLOT_W;
          return (
            <g key={k}>
              <line x1={x} y1={PAD.top + PLOT_H} x2={x} y2={PAD.top + PLOT_H + 5} stroke="#94a3b8" />
              <text x={x} y={PAD.top + PLOT_H + 20} fill="#94a3b8" fontSize="11" textAnchor="middle">{utcClock(t)}</text>
            </g>
          );
        })}

        {series.map(s => (
          <g key={s.key}>
            <path data-series={s.key} d={pathOf(s)} fill="none" stroke={colorOf(s)} strokeWidth={s.axis === 'left' ? 2.5 : 2} strokeDasharray={s.axis === 'right' ? '4 3' : undefined} />
            {visible.length <= 60 && visible.filter(p => typeof p[s.key] === 'number').map(p => (
              <circle key={p.timestamp} data-point={s.key} cx={xOf(p.timestamp)} cy={yOf(p[s.key], s.axis === 'left' ? leftMax : rightMax)} r="2.5" fill={colorOf(s)} />
            ))}
          </g>
        ))}

        {showMarker && (
          <g data-testid="chart-marker">
            <line x1={xOf(markerTimestamp!)} y1={PAD.top} x2={xOf(markerTimestamp!)} y2={PAD.top + PLOT_H} stroke="#ef4444" strokeWidth="1.5" />
            <text x={xOf(markerTimestamp!)} y={PAD.top - 6} fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle">{markerLabel || utcClock(markerTimestamp!)}</text>
          </g>
        )}

        {hover && (
          <g>
            <line x1={xOf(hover.timestamp)} y1={PAD.top} x2={xOf(hover.timestamp)} y2={PAD.top + PLOT_H} stroke="#94a3b8" strokeDasharray="3 3" strokeWidth="1.5" />
            {series.filter(s => typeof hover[s.key] === 'number').map(s => (
              <circle key={s.key} cx={xOf(hover.timestamp)} cy={yOf(hover[s.key], s.axis === 'left' ? leftMax : rightMax)} r="5" fill={colorOf(s)} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        )}

        {drag && (
          <rect
            x={Math.min(xOf(drag.start), xOf(drag.current))}
            y={PAD.top}
            width={Math.abs(xOf(drag.current) - xOf(drag.start))}
            height={PLOT_H}
            fill="rgba(59,130,246,0.25)"
            stroke="#3b82f6"
            strokeDasharray="2 2"
          />
        )}
      </svg>

      {hover && (
        <div data-testid="chart-tooltip" style={{ position: 'absolute', top: '36px', left: `${Math.min(70, (xOf(hover.timestamp) / WIDTH) * 100)}%`, marginLeft: '12px', background: '#1e293b', border: '1px solid #3b82f6', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', pointerEvents: 'none', zIndex: 10, whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{utcClock(hover.timestamp, true)}</div>
          {series.map(s => (
            <div key={s.key} style={{ color: colorOf(s) }}>
              {s.label}: <strong>{formatValue(hover[s.key])}{typeof hover[s.key] === 'number' ? unitSuffix(s.unit) : ''}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
