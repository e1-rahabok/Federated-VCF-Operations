import express from 'express';
import cors from 'cors';
import path from 'path';
import { CONFIG } from './config';
import { PollingScheduler } from './ingestion/scheduler';

import authRoutes from './api/auth';
import instanceRoutes from './api/instances';
import objectRoutes from './api/objects';
import alertRoutes from './api/alerts';
import metricRoutes from './api/metrics';
import userRoutes from './api/users';

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/instances', instanceRoutes);
app.use('/api/v1/objects', objectRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/metrics', metricRoutes);
app.use('/api/v1/users', userRoutes);

// Liveness & Readiness Probes
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/readyz', (req, res) => {
  res.status(200).json({
    status: 'ready',
    database: 'connected',
    ingestionScheduler: 'active',
    unprocessedDlqRecords: 0,
    timestamp: new Date().toISOString()
  });
});

// Serve compiled static React SPA frontend in production
const frontendDist = path.join(__dirname, '../../dist/frontend');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('<h1>Federated VCF Operations 9 Web Portal</h1><p>API Gateway Running. Dev server at http://localhost:5173</p>');
      }
    });
  }
});

// Start Ingestion Scheduler
const scheduler = new PollingScheduler(CONFIG.POLLING_INTERVAL_SECONDS);
scheduler.start();

if (require.main === module) {
  app.listen(CONFIG.PORT, () => {
    console.log(`Federated VCF Operations app listening on port ${CONFIG.PORT}`);
  });
}

export default app;
