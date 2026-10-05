import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.ts';
import { getDatabase } from './db/database.ts';

import authRoutes from './api/auth.ts';
import instanceRoutes from './api/instances.ts';
import objectRoutes from './api/objects.ts';
import alertRoutes from './api/alerts.ts';
import metricRoutes from './api/metrics.ts';
import userRoutes from './api/users.ts';
import systemRoutes from './api/system.ts';

/**
 * Builds the single application: REST API under /api/v1 plus the compiled React SPA.
 * No listener or scheduler is started here so tests can mount the app on any port.
 */
export function createApp() {
  getDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/instances', instanceRoutes);
  app.use('/api/v1/objects', objectRoutes);
  app.use('/api/v1/alerts', alertRoutes);
  app.use('/api/v1/metrics', metricRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/system', systemRoutes);
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Liveness & Readiness Probes
  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/readyz', (req, res) => {
    try {
      getDatabase().prepare('SELECT 1 as ok').get();
      res.status(200).json({ status: 'ready', database: 'connected (node:sqlite)', timestamp: new Date().toISOString() });
    } catch (err: any) {
      res.status(503).json({ status: 'not ready', database: err.message, timestamp: new Date().toISOString() });
    }
  });

  // Serve the compiled React SPA; every non-API path falls through to index.html for client routing.
  const indexHtml = path.join(CONFIG.FRONTEND_DIST, 'index.html');
  app.use(express.static(CONFIG.FRONTEND_DIST));
  app.get('*', (req, res) => {
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      res.status(503).send('Frontend bundle not found. Run "npm run build", or use "npm run dev:frontend" during development.');
    }
  });

  return app;
}
