import { getDatabase } from '../db/database.ts';

export default function userRoutes(req: any, res: any, next: any) {
  if (req.method === 'PUT') {
    return res.json({ status: 'success' });
  }

  return res.json({
    widgets: [
      { id: 'w1', type: 'ACTIVE_ALERTS', title: 'Active Alerts Summary', x: 0, y: 0, w: 6, h: 4 },
      { id: 'w2', type: 'PINNED_OBJECTS', title: 'Pinned Infrastructure Objects', x: 6, y: 0, w: 6, h: 4 },
      { id: 'w3', type: 'INGESTION_STATUS', title: 'VCF Ingestion Status', x: 0, y: 4, w: 6, h: 4 },
      { id: 'w4', type: 'QUICK_LAUNCHER', title: 'Quick Metrics Launcher', x: 6, y: 4, w: 6, h: 4 }
    ]
  });
}
