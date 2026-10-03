import { getDatabase } from '../db/database.ts';

export default function metricRoutes(req: any, res: any, next: any) {
  const now = Date.now();

  if (req.url?.includes('/kpi')) {
    const points = [];
    for (let i = 24; i >= 0; i--) {
      points.push({
        timestamp: now - i * 60 * 60 * 1000,
        cpuUsage: Math.floor(Math.sin(i) * 20 + 55),
        memUsage: Math.floor(Math.cos(i) * 15 + 70),
        diskLatencyMs: Math.floor(Math.random() * 8 + 3),
        netThroughputKb: Math.floor(Math.random() * 5000 + 12000)
      });
    }
    return res.json(points);
  }

  const points = [];
  for (let ts = now - 24 * 60 * 60 * 1000; ts <= now; ts += 5 * 60 * 1000) {
    points.push({
      timestamp: ts,
      'cpu|usage_average': Math.floor(Math.sin(ts / 100000) * 20 + 50),
      'cpu|ready_summation': Math.floor(Math.cos(ts / 100000) * 10 + 12),
      'mem|usage_average': Math.floor(Math.sin(ts / 200000) * 15 + 65)
    });
  }

  return res.json(points);
}
