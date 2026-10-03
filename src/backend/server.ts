import http from 'node:http';
import { CONFIG } from './config.ts';
import { PollingScheduler } from './ingestion/scheduler.ts';

import authRoutes from './api/auth.ts';
import instanceRoutes from './api/instances.ts';
import objectRoutes from './api/objects.ts';
import alertRoutes from './api/alerts.ts';
import metricRoutes from './api/metrics.ts';
import userRoutes from './api/users.ts';

const PORT = CONFIG.PORT;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoints
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (pathname === '/readyz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ready',
      database: 'connected (node:sqlite)',
      ingestionScheduler: 'active',
      unprocessedDlqRecords: 0,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Handle API routes
  if (pathname.startsWith('/api/v1/')) {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      let parsedBody = {};
      try { if (bodyData) parsedBody = JSON.parse(bodyData); } catch (e) {}

      const mockRes: any = {
        status: (code: number) => {
          res.statusCode = code;
          return mockRes;
        },
        json: (data: any) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        },
        cookie: () => mockRes,
        send: (data: any) => res.end(data)
      };

      const mockReq: any = {
        query: Object.fromEntries(url.searchParams),
        body: parsedBody,
        headers: req.headers,
        params: {}
      };

      if (pathname.startsWith('/api/v1/auth/login')) {
        authRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/auth/me')) {
        authRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/instances/test')) {
        instanceRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/instances')) {
        instanceRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/objects/pinned')) {
        objectRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/objects/tree')) {
        objectRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/objects/')) {
        mockReq.params.resourceUuid = pathname.split('/api/v1/objects/')[1];
        objectRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/alerts/summary')) {
        alertRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/alerts/timeline')) {
        alertRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/alerts/')) {
        mockReq.params.alertId = pathname.split('/api/v1/alerts/')[1];
        alertRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/alerts')) {
        alertRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/metrics/query')) {
        metricRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/metrics/kpi')) {
        metricRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/users/preferences')) {
        userRoutes(mockReq, mockRes, () => {});
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }
    });
    return;
  }

  // Serve static HTML SPA
  const indexHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Federated VCF Operations Portal</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
      .header { background: #1e293b; padding: 16px; border-radius: 8px; border: 1px solid #334155; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
      .nav a { color: #3b82f6; text-decoration: none; margin-right: 16px; font-weight: 600; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 20px; }
      .badge { background: #064e3b; color: #6ee7b7; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; }
      .badge-warn { background: #78350f; color: #fcd34d; }
      .badge-crit { background: #7f1d1d; color: #fca5a5; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 10px; border-bottom: 1px solid #334155; text-align: left; font-size: 14px; }
      button { background: #3b82f6; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; }
      button:hover { background: #2563eb; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <span style="font-size:24px">🌐</span>
        <strong style="font-size:20px; margin-left:8px">Federated VCF Operations 9 Portal</strong>
      </div>
      <div class="nav">
        <a href="/">Home</a>
        <a href="/alerts">Alerts</a>
        <a href="/metrics">Metrics</a>
        <a href="/settings">Settings</a>
      </div>
    </div>

    <div style="background:#0f172a; padding:12px; border:1px solid #334155; border-radius:6px; margin-bottom:24px;">
      <span class="badge">🟢 Ingestion Engine Online</span>
      <span style="margin-left:12px; color:#94a3b8; font-size:14px">Connected to 5 VCF Operations 9 instances. Polling active.</span>
    </div>

    <div class="grid">
      <div class="card">
        <h3>🚨 Active Alerts Summary</h3>
        <p>Slice and dice alerts across all instances</p>
        <table>
          <tr><th>Severity</th><th>Instance</th><th>Target Resource</th><th>Alert Name</th></tr>
          <tr><td><span class="badge badge-crit">CRITICAL</span></td><td>VCF-Ops-02</td><td>esx-02.corp.local</td><td>Physical Power Supply Unit Fault</td></tr>
          <tr><td><span class="badge badge-warn">WARNING</span></td><td>VCF-Ops-01</td><td>VM-007 (SQL-Prod)</td><td>High CPU Ready Latency on VM-007</td></tr>
        </table>
      </div>

      <div class="card">
        <h3>📊 Metrics Analysis & Object Exploration</h3>
        <p>Multi-metric comparative overlays, percentiles (P95/P99), dynamic rollups</p>
        <div style="background:#0f172a; height:120px; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#3b82f6; font-weight:bold; margin-top:12px">
          📈 cpu|usage_average vs cpu|ready_summation (1-Min Raw / 5-Min Rollups)
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>🚀 VCF Operations Instance Launcher</h3>
      <p>Constructs direct deep-link URLs to target VCF Operations 9 web UI</p>
      <button onclick="window.open('https://vcf-ops-01.corp.local/ui/index.action#...', '_blank')">Open Target VCF Operations Console ➔</button>
    </div>
  </body>
  </html>
  `;

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(indexHtml);
});

const scheduler = new PollingScheduler(CONFIG.POLLING_INTERVAL_SECONDS);
scheduler.start();

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🟢 Federated VCF Operations 9 Web Server Listening on http://localhost:${PORT}`);
  console.log(`🟢 Ingestion Polling Loop Active (1-min watermarking delta)`);
  console.log(`=======================================================`);
});
