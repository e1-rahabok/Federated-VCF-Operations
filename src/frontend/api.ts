import { useCallback, useEffect, useState } from 'react';

// Empty in the browser (same origin). Tests point it at a server on another port.
let apiBase = '';

export function setApiBase(base: string): void {
  apiBase = base;
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(`${apiBase}/api/v1${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Request failed with HTTP ${res.status}`);
  }
  return data as T;
}

export const apiGet = <T = any>(path: string) => request<T>('GET', path);
export const apiPost = <T = any>(path: string, body: any) => request<T>('POST', path, body);
export const apiPut = <T = any>(path: string, body: any) => request<T>('PUT', path, body);
export const apiDelete = <T = any>(path: string) => request<T>('DELETE', path);

/** Loads `path` whenever it changes. Pass null to skip the request. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiGet<T>(path)
      .then(result => { if (!cancelled) { setData(result); setError(null); } })
      .catch(err => { if (!cancelled) { setData(null); setError(err.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { data, error, loading, reload };
}

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
};

export const TIME_RANGES = [
  { value: '1h', label: 'Last 1 Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' }
];

export function rangeToMs(range: string): number {
  return RANGE_MS[range] || RANGE_MS['24h'];
}

export function instanceQuery(instanceId: string): string {
  return instanceId && instanceId !== 'ALL' ? `instanceId=${encodeURIComponent(instanceId)}` : '';
}

export function formatUtc(timestamp: number | null | undefined): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
}

export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2).replace(/\.?0+$/, '');
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = rows
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface PageProps {
  onNavigate: (path: string) => void;
  instanceId: string;
  timeRange: string;
}
