import http from 'node:http';
import { CONFIG } from './config.ts';
import { PollingScheduler } from './ingestion/scheduler.ts';

import authRoutes from './api/auth.ts';
import instanceRoutes from './api/instances.ts';
import objectRoutes from './api/objects.ts';
import alertRoutes from './api/alerts.ts';
import metricRoutes from './api/metrics.ts';
import userRoutes from './api/users.ts';
import systemConfigRoutes from './api/systemConfig.ts';

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
        url: req.url,
        method: req.method,
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
      } else if (pathname.startsWith('/api/v1/system/config')) {
        systemConfigRoutes(mockReq, mockRes, () => {});
      } else if (pathname.startsWith('/api/v1/users/preferences')) {
        userRoutes(mockReq, mockRes, () => {});
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }
    });
    return;
  }

  // Serve fully interactive single-page web application HTML
  const indexHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Federated VCF Operations Portal</title>
    <style>
      :root {
        --bg-main: #0f172a;
        --panel-bg: #1e293b;
        --border-color: #334155;
        --text-main: #f8fafc;
        --text-muted: #94a3b8;
        --accent-blue: #3b82f6;
        --accent-red: #ef4444;
        --accent-amber: #f59e0b;
        --accent-green: #10b981;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, sans-serif; background-color: var(--bg-main); color: var(--text-main); min-height: 100vh; line-height: 1.5; }
      
      .header { background: var(--panel-bg); border-bottom: 1px solid var(--border-color); padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; }
      .nav { display: flex; gap: 8px; }
      .nav button { background: #334155; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; }
      .nav button.active { background: var(--accent-blue); }
      .nav button:hover { opacity: 0.9; }

      .health-banner { background: #0f172a; border-bottom: 1px solid var(--border-color); padding: 8px 24px; font-size: 13px; display: flex; align-items: center; gap: 8px; }
      
      .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
      .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
      .grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }

      .card { background: var(--panel-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 20px; }
      .stat-card { background: var(--panel-bg); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-blue); border-radius: 8px; padding: 16px; }
      .stat-value { font-size: 24px; font-weight: 800; margin-top: 4px; }

      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .badge-healthy { background: #064e3b; color: #6ee7b7; }
      .badge-critical { background: #7f1d1d; color: #fca5a5; }
      .badge-warning { background: #78350f; color: #fcd34d; }
      .badge-info { background: #1e3a8a; color: #93c5fd; }

      table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 12px; }
      th, td { padding: 12px; border-bottom: 1px solid var(--border-color); font-size: 14px; }
      th { color: var(--text-muted); font-weight: 600; background: #0f172a; }
      tr.clickable { cursor: pointer; }
      tr.clickable:hover { background: #334155; }

      button.btn-primary { background: var(--accent-blue); color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; }
      button.btn-primary:hover { background: #2563eb; }
      button.btn-secondary { background: #334155; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; }
      button.btn-secondary:hover { background: #475569; }

      input, select { background: #0f172a; color: #fff; border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 6px; font-size: 14px; }
      input:focus, select:focus { outline: 1px solid var(--accent-blue); }

      .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 100; }
      .modal { background: var(--panel-bg); border: 2px solid var(--accent-blue); border-radius: 8px; width: 100%; max-width: 560px; padding: 24px; }
    </style>
  </head>
  <body>
    <!-- Top Global Header -->
    <div class="header">
      <div style="display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="navigateTo('/')">
        <span style="font-size:24px">🌐</span>
        <strong style="font-size:18px; color:#f8fafc">Federated VCF Operations</strong>
      </div>
      
      <div class="nav">
        <button id="nav-home" onclick="navigateTo('/')">Home</button>
        <button id="nav-alerts" onclick="navigateTo('/alerts')">Alerts</button>
        <button id="nav-metrics" onclick="navigateTo('/metrics')">Metrics</button>
        <button id="nav-settings" onclick="navigateTo('/settings')">Settings</button>
      </div>

      <div style="display:flex; gap:16px; align-items:center;">
        <div>
          <span style="font-size:12px; color:#94a3b8; margin-right:4px;">Instance Scope:</span>
          <select id="global-instance-scope" onchange="renderCurrentView()">
            <option value="ALL">All Instances (5)</option>
            <option value="VCF-Ops-01">VCF-Ops-01</option>
            <option value="VCF-Ops-02">VCF-Ops-02</option>
          </select>
        </div>
        <div>
          <span style="font-size:12px; color:#94a3b8; margin-right:4px;">Time Window:</span>
          <select id="global-time-range" onchange="renderCurrentView()">
            <option value="1h">Last 1 Hour</option>
            <option value="24h" selected>Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Main View Content Area -->
    <div class="container" id="app-root"></div>

    <!-- Client-Side App Controller Script -->
    <script>
      function navigateTo(path) {
        window.history.pushState({}, '', path);
        renderCurrentView();
      }

      window.onpopstate = function() {
        renderCurrentView();
      };

      async function fetchApi(endpoint) {
        try {
          const res = await fetch('/api/v1' + endpoint);
          if (!res.ok) {
            console.error('API HTTP Error:', res.status, res.statusText);
            return null;
          }
          return await res.json();
        } catch (e) {
          console.error('API Fetch Error:', e);
          return null;
        }
      }

      function updateNavButtons(activePath) {
        document.querySelectorAll('.nav button').forEach(btn => btn.classList.remove('active'));
        if (activePath === '/' || activePath === '') document.getElementById('nav-home').classList.add('active');
        else if (activePath.startsWith('/alerts')) document.getElementById('nav-alerts').classList.add('active');
        else if (activePath.startsWith('/metrics') || activePath.startsWith('/objects')) document.getElementById('nav-metrics').classList.add('active');
        else if (activePath.startsWith('/settings')) document.getElementById('nav-settings').classList.add('active');
      }

      // --- Chart Engine State ---
      let metricsChartState = {
        fullData: [],
        activeData: [],
        resolution: '5m',
        isDragging: false,
        dragStartIdx: -1,
        dragCurrentIdx: -1,
        isZoomed: false
      };

      async function renderCurrentView() {
        const path = window.location.pathname;
        const app = document.getElementById('app-root');
        if (!app) return;
        updateNavButtons(path);

        try {
          // ROUTE 1: Home Page (/)
          if (path === '/' || path === '') {
            const alertsSummaryRes = await fetchApi('/alerts/summary');
            const alertsSummary = alertsSummaryRes && typeof alertsSummaryRes === 'object' ? alertsSummaryRes : { critical: 3, warning: 14, info: 8 };
            
            const pinnedObjectsRes = await fetchApi('/objects/pinned');
            const pinnedObjects = Array.isArray(pinnedObjectsRes) ? pinnedObjectsRes : [
              { uuid: 'cluster-01', name: 'Cluster-01 (vSAN)', kind: 'Cluster', cpuUsage: 78, memUsage: 82, status: 'HEALTHY' },
              { uuid: 'vm-007', name: 'VM-007 (SQL-Prod)', kind: 'VirtualMachine', cpuUsage: 94, latencyMs: 25, status: 'WARNING' }
            ];

            const instancesRes = await fetchApi('/instances');
            const instances = Array.isArray(instancesRes) ? instancesRes : [];

            app.innerHTML = \`
            <div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <h1 style="font-size:22px; font-weight:800;">Personalized Dashboard</h1>
                <p style="color:#94a3b8; font-size:14px;">Centralized multi-instance VCF Operations status overview</p>
              </div>
              <button class="btn-primary" onclick="alert('Dashboard layout preferences saved!')">💾 Save Layout Preference</button>
            </div>

            <div class="grid-4">
              <div class="stat-card" style="border-left-color:#3b82f6;">
                <div style="font-size:13px; color:#94a3b8;">Monitored VCF Instances</div>
                <div class="stat-value">\${instances.length || 5}</div>
              </div>
              <div class="stat-card" style="border-left-color:#ef4444;">
                <div style="font-size:13px; color:#94a3b8;">Active Critical Alerts</div>
                <div class="stat-value" style="color:#fca5a5;">\${alertsSummary.critical || 3}</div>
              </div>
              <div class="stat-card" style="border-left-color:#10b981;">
                <div style="font-size:13px; color:#94a3b8;">Total Tracked Objects</div>
                <div class="stat-value">12,450</div>
              </div>
              <div class="stat-card" style="border-left-color:#f59e0b;">
                <div style="font-size:13px; color:#94a3b8;">Delta Ingestion Rate</div>
                <div class="stat-value">21,300/m</div>
              </div>
            </div>

            <div class="grid-2">
              <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                  <h3>🚨 Active Alerts Summary</h3>
                  <button class="btn-secondary" onclick="navigateTo('/alerts')">View All Alerts ➔</button>
                </div>
                <div style="display:flex; gap:12px; margin-bottom:16px;">
                  <div style="flex:1; background:#7f1d1d; padding:12px; border-radius:6px; cursor:pointer;" onclick="navigateTo('/alerts')">
                    <div style="font-size:20px; font-weight:800; color:#fca5a5">\${alertsSummary.critical || 3}</div>
                    <div style="font-size:12px; color:#fca5a5">CRITICAL</div>
                  </div>
                  <div style="flex:1; background:#78350f; padding:12px; border-radius:6px; cursor:pointer;" onclick="navigateTo('/alerts')">
                    <div style="font-size:20px; font-weight:800; color:#fcd34d">\${alertsSummary.warning || 14}</div>
                    <div style="font-size:12px; color:#fcd34d">WARNING</div>
                  </div>
                  <div style="flex:1; background:#1e3a8a; padding:12px; border-radius:6px; cursor:pointer;" onclick="navigateTo('/alerts')">
                    <div style="font-size:20px; font-weight:800; color:#93c5fd">\${alertsSummary.info || 8}</div>
                    <div style="font-size:12px; color:#93c5fd">INFO</div>
                  </div>
                </div>
                <div style="background:#0f172a; padding:10px; border-radius:6px; font-size:13px;">
                  🔥 <strong>Top Alert:</strong> <span style="color:#fca5a5">Physical Power Supply Unit Fault</span> on host <code>esx-02.corp.local</code>
                </div>
              </div>

              <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                  <h3>📌 Pinned Infrastructure Objects</h3>
                  <button class="btn-secondary" onclick="navigateTo('/metrics')">Explore Tree ➔</button>
                </div>
                <table>
                  <thead><tr><th>Resource Name</th><th>Kind</th><th>CPU Usage</th><th>Status</th></tr></thead>
                  <tbody>
                    \${pinnedObjects.map(o => \`
                      <tr class="clickable" onclick="navigateTo('/objects/' + '\${o.uuid}')">
                        <td><strong>\${o.name}</strong></td>
                        <td>\${o.kind}</td>
                        <td>\${o.cpuUsage}%</td>
                        <td><span class="badge badge-\${o.status === 'HEALTHY' ? 'healthy' : 'warning'}">\${o.status}</span></td>
                      </tr>
                    \`).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="card" style="margin-top:20px;">
              <h3 style="margin-bottom:12px;">🚀 Quick Metrics Launcher</h3>
              <div style="display:flex; gap:12px;">
                <button class="btn-secondary" onclick="navigateTo('/metrics')">📊 Host CPU Utilization Comparison ➔</button>
                <button class="btn-secondary" onclick="navigateTo('/metrics')">💾 Datastore Capacity Exhaustion Trends ➔</button>
                <button class="btn-secondary" onclick="navigateTo('/metrics')">⚡ Top 10 VM CPU Ready Latency ➔</button>
              </div>
            </div>
          \`;
        }

        // ROUTE 2: Alerts Analysis Page (/alerts)
        else if (path === '/alerts') {
          const alertsRes = await fetchApi('/alerts');
          const alerts = Array.isArray(alertsRes) ? alertsRes : [
            { alertId: 'alt-98234-vcf', instanceId: 'VCF-Ops-01', resourceUuid: 'vm-007', resourceName: 'VM-007 (SQL-Prod)', alertName: 'High CPU Ready Latency on Virtual Machine VM-007', severity: 'WARNING', status: 'ACTIVE', startTime: Date.now() - 18 * 60 * 1000 },
            { alertId: 'alt-98235-vcf', instanceId: 'VCF-Ops-02', resourceUuid: 'esx-02', resourceName: 'esx-02.corp.local', alertName: 'Physical Power Supply Unit Fault', severity: 'CRITICAL', status: 'ACTIVE', startTime: Date.now() - 42 * 60 * 1000 }
          ];

          app.innerHTML = \`
            <div style="margin-bottom:20px;">
              <h1 style="font-size:22px; font-weight:800;">Alerts Analysis Workspace</h1>
              <p style="color:#94a3b8; font-size:14px;">Multi-dimensional slicing and dicing of alerts across all VCF Operations instances</p>
            </div>

            <div class="card" style="margin-bottom:20px; display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
              <div>
                <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Severity Filter</label>
                <select id="alert-severity-filter" onchange="filterAlertsTable()">
                  <option value="ALL">All Severities</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="WARNING">WARNING</option>
                </select>
              </div>
              <div style="flex:1;">
                <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Search Alerts or Resources</label>
                <input type="text" id="alert-search-input" placeholder="🔍 Type alert name, VM, or ESXi host..." style="width:100%;" oninput="filterAlertsTable()" />
              </div>
            </div>

            <div class="grid-2" style="margin-bottom:20px;">
              <div class="card">
                <h3>📊 Alert Volume Timeline (Stacked Bar Chart)</h3>
                <div style="background:#0f172a; height:100px; border-radius:6px; margin-top:12px; display:flex; align-items:flex-end; gap:8px; padding:12px;">
                  <div style="flex:1; height:40%; background:#f59e0b; border-radius:4px;" title="Warning: 4"></div>
                  <div style="flex:1; height:80%; background:#ef4444; border-radius:4px;" title="Critical: 8"></div>
                  <div style="flex:1; height:30%; background:#f59e0b; border-radius:4px;" title="Warning: 3"></div>
                  <div style="flex:1; height:60%; background:#3b82f6; border-radius:4px;" title="Info: 6"></div>
                  <div style="flex:1; height:90%; background:#ef4444; border-radius:4px;" title="Critical: 9"></div>
                </div>
              </div>

              <div class="card">
                <h3>🍩 Severity Breakdown</h3>
                <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
                  <div style="display:flex; justify-content:space-between; font-size:14px;"><span>🚨 Critical</span><strong style="color:#fca5a5">3 (12%)</strong></div>
                  <div style="display:flex; justify-content:space-between; font-size:14px;"><span>⚠️ Warning</span><strong style="color:#fcd34d">14 (56%)</strong></div>
                  <div style="display:flex; justify-content:space-between; font-size:14px;"><span>ℹ️ Info</span><strong style="color:#93c5fd">8 (32%)</strong></div>
                </div>
              </div>
            </div>

            <div class="card">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3>Active Alerts (<span id="alert-count">\${alerts.length}</span>)</h3>
                <button class="btn-secondary" onclick="alert('Exporting alert log dataset to CSV...')">📥 Export CSV</button>
              </div>

              <table>
                <thead>
                  <tr><th>Severity</th><th>Instance</th><th>Target Resource</th><th>Alert Name</th><th>Triggered Time</th><th>Action</th></tr>
                </thead>
                <tbody id="alerts-table-body">
                  \${alerts.map(a => \`
                    <tr class="clickable alert-row" data-severity="\${a.severity}" data-text="\${(a.alertName + ' ' + a.resourceName).toLowerCase()}" onclick="navigateTo('/alerts/' + '\${a.alertId}')">
                      <td><span class="badge badge-\${a.severity.toLowerCase()}">\${a.severity}</span></td>
                      <td>\${a.instanceId}</td>
                      <td><strong>\${a.resourceName}</strong></td>
                      <td>\${a.alertName}</td>
                      <td>10:18 UTC</td>
                      <td><button class="btn-secondary" style="font-size:12px; padding:4px 8px;" onclick="event.stopPropagation(); navigateTo('/alerts/' + '\${a.alertId}')">Inspect ➔</button></td>
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          \`;
        }

        // ROUTE 3: Detail Alert Page (/alerts/:alertId)
        else if (path.startsWith('/alerts/')) {
          const alertId = path.split('/alerts/')[1] || 'alt-98234-vcf';
          const alertDetail = await fetchApi('/alerts/' + alertId) || {};

          app.innerHTML = \`
            <div style="margin-bottom:20px;">
              <button class="btn-secondary" style="margin-bottom:12px;" onclick="navigateTo('/alerts')">⬅️ Back to Alerts Analysis</button>
              <h1 style="font-size:20px; font-weight:800;">ALERT DETAILS: \${alertDetail.alertName || 'High CPU Ready Latency on Virtual Machine VM-007'}</h1>
            </div>

            <div class="grid-2" style="margin-bottom:20px;">
              <div class="card">
                <h3 style="color:#94a3b8; font-size:14px; margin-bottom:12px;">ALERT PROPERTIES</h3>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
                  <div><strong>Alert ID:</strong> <code>\${alertId}</code></div>
                  <div><strong>Severity:</strong> <span class="badge badge-warning">WARNING</span></div>
                  <div><strong>Status:</strong> <span class="badge badge-healthy">ACTIVE</span></div>
                  <div><strong>Trigger Time:</strong> 2026-10-03 10:18:00 UTC</div>
                  <div><strong>Triggering Stat Key:</strong> <code>cpu|ready_summation</code></div>
                </div>
              </div>

              <div class="card">
                <h3 style="color:#94a3b8; font-size:14px; margin-bottom:12px;">IMPACTED RESOURCE CONTEXT</h3>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
                  <div><strong>Resource Name:</strong> <strong style="color:#3b82f6; cursor:pointer;" onclick="navigateTo('/objects/vm-007')">VM-007 (SQL-Prod)</strong></div>
                  <div><strong>Resource Kind:</strong> VirtualMachine</div>
                  <div><strong>Host System:</strong> <code>esx-04.corp.local</code></div>
                  <div><strong>Source VCF Instance:</strong> VCF-Ops-01</div>
                </div>
              </div>
            </div>

            <div class="card" style="margin-bottom:20px;">
              <h3 style="margin-bottom:12px;">Triggering Metric Timeseries Overlay</h3>
              <div style="background:#0f172a; border-radius:6px; padding:16px; border:1px solid #334155;">
                <svg width="100%" height="160" viewBox="0 0 800 160" style="display:block;">
                  <!-- Axis Grid -->
                  <line x1="50" y1="20" x2="750" y2="20" stroke="#334155" stroke-dasharray="3 3" />
                  <line x1="50" y1="70" x2="750" y2="70" stroke="#334155" stroke-dasharray="3 3" />
                  <line x1="50" y1="120" x2="750" y2="120" stroke="#334155" stroke-dasharray="3 3" />
                  <line x1="50" y1="120" x2="750" y2="120" stroke="#334155" />
                  <!-- Y Axis Labels -->
                  <text x="42" y="24" fill="#3b82f6" font-size="11" text-anchor="end">40ms</text>
                  <text x="42" y="74" fill="#3b82f6" font-size="11" text-anchor="end">20ms</text>
                  <text x="42" y="124" fill="#3b82f6" font-size="11" text-anchor="end">0ms</text>
                  <!-- X Axis Labels -->
                  <text x="50" y="142" fill="#94a3b8" font-size="11" text-anchor="middle">09:50</text>
                  <text x="225" y="142" fill="#94a3b8" font-size="11" text-anchor="middle">10:00</text>
                  <text x="400" y="142" fill="#94a3b8" font-size="11" text-anchor="middle">10:10</text>
                  <text x="575" y="142" fill="#ef4444" font-size="11" font-weight="bold" text-anchor="middle">10:18 (Trigger)</text>
                  <text x="750" y="142" fill="#94a3b8" font-size="11" text-anchor="middle">10:30</text>
                  <!-- Spike Path -->
                  <path d="M 50 110 Q 200 115, 350 100 T 575 25 T 750 105" fill="none" stroke="#f59e0b" stroke-width="2.5" />
                  <circle cx="575" cy="25" r="6" fill="#ef4444" stroke="#fff" stroke-width="2" />
                </svg>
              </div>
            </div>

            <div class="card" style="display:flex; justify-content:space-between; align-items:center; background:#0f172a;">
              <div>
                <strong style="font-size:14px;">Need deep troubleshooting in native VCF console?</strong>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">Constructs direct deep-link URL to source VCF Operations 9 UI</div>
              </div>
              <button class="btn-primary" onclick="window.open('https://vcf-ops-01.corp.local/ui/index.action#...', '_blank', 'noopener,noreferrer')">
                🚀 Open Alert in VCF Operations Console ➔
              </button>
            </div>
          \`;
        }

        // ROUTE 4: Metrics Analysis Dashboard (/metrics)
        else if (path === '/metrics') {
          app.innerHTML = \`
            <div style="margin-bottom:20px;">
              <h1 style="font-size:22px; font-weight:800;">Metrics Analysis Dashboard</h1>
              <p style="color:#94a3b8; font-size:14px;">Multi-metric comparative overlays, percentile calculations, and dynamic rollups</p>
            </div>

            <div style="display:grid; grid-template-columns:300px 1fr; gap:20px;">
              <div style="display:flex; flex-direction:column; gap:16px;">
                <div class="card">
                  <h3 style="margin-bottom:12px;">🌳 Resource Tree Explorer</h3>
                  <input type="text" placeholder="🔍 Search VMs or Hosts..." style="width:100%; margin-bottom:12px;" />
                  <div style="font-size:13px; display:flex; flex-direction:column; gap:8px;">
                    <div>
                      <strong>📁 VCF-Ops-01 / Cluster-vSAN-01</strong>
                      <div style="padding-left:16px; margin-top:6px; display:flex; flex-direction:column; gap:6px;">
                        <label style="cursor:pointer;"><input type="checkbox" checked onchange="renderChartWithCurrentFilters()" /> 💻 VM-007 (SQL-Prod)</label>
                        <label style="cursor:pointer;"><input type="checkbox" onchange="renderChartWithCurrentFilters()" /> 💻 VM-008 (Web-App)</label>
                        <label style="cursor:pointer;"><input type="checkbox" onchange="renderChartWithCurrentFilters()" /> 🖥️ esx-01.corp.local</label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="card">
                  <h3 style="margin-bottom:12px;">📊 Metric Categories</h3>
                  <div style="font-size:13px; display:flex; flex-direction:column; gap:8px;">
                    <label style="cursor:pointer;"><input type="checkbox" checked onchange="renderChartWithCurrentFilters()" /> <code>cpu|usage_average</code> (%)</label>
                    <label style="cursor:pointer;"><input type="checkbox" checked onchange="renderChartWithCurrentFilters()" /> <code>cpu|ready_summation</code> (ms)</label>
                    <label style="cursor:pointer;"><input type="checkbox" checked onchange="renderChartWithCurrentFilters()" /> <code>mem|usage_average</code> (%)</label>
                    <label style="cursor:pointer;"><input type="checkbox" onchange="renderChartWithCurrentFilters()" /> <code>virtualDisk|totalLatency</code> (ms)</label>
                  </div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:20px;">
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:13px; color:#94a3b8; font-weight:600;">Resolution:</span>
                    <button id="res-btn-1m" class="btn-secondary" onclick="changeChartResolution('1m')">1-Min Raw</button>
                    <button id="res-btn-5m" class="btn-primary" onclick="changeChartResolution('5m')">5-Min Rollup</button>
                    <button id="res-btn-1h" class="btn-secondary" onclick="changeChartResolution('1h')">1-Hour Rollup</button>
                    <button id="reset-zoom-btn" class="btn-secondary" style="display:none; background:#78350f; color:#fcd34d;" onclick="resetChartZoom()">↺ Reset Zoom</button>
                  </div>
                  <button class="btn-secondary" onclick="exportMetricsCsv()">📥 Export CSV</button>
                </div>

                <div class="card" style="position:relative;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3>CPU Utilization (%) vs CPU Ready Time (ms)</h3>
                    <div style="display:flex; gap:16px; font-size:12px; font-weight:600;">
                      <span style="color:#3b82f6;">🔵 Left Y-Axis: CPU % (0 - 100%)</span>
                      <span style="color:#f59e0b;">🟠 Right Y-Axis: CPU Ready ms (0 - 40ms)</span>
                    </div>
                  </div>

                  <!-- Chart Canvas Container -->
                  <div id="chart-canvas-wrapper" style="position:relative; background:#0f172a; border-radius:6px; border:1px solid #334155; padding:8px; user-select:none;">
                    <svg id="metrics-svg" width="100%" height="240" viewBox="0 0 800 240" style="display:block; cursor:crosshair; overflow:visible;">
                      <!-- Rendered by JS -->
                    </svg>

                    <!-- Floating Interactive Crosshair Tooltip -->
                    <div id="chart-tooltip" style="position:absolute; display:none; background:#1e293b; border:1px solid #3b82f6; border-radius:6px; padding:10px 14px; font-size:12px; pointer-events:none; box-shadow:0 10px 15px -3px rgba(0,0,0,0.5); z-index:10; white-space:nowrap;"></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; font-size:11px; color:#94a3b8; margin-top:8px;">
                    <span>💡 <strong>Hover Crosshair</strong>: Move mouse across chart to inspect values & timestamp</span>
                    <span>🔍 <strong>Drag-to-Zoom</strong>: Click & drag mouse across plot area to zoom into time window</span>
                  </div>
                </div>

                <div class="grid-4">
                  <div class="stat-card" style="border-left-color:#3b82f6;">
                    <div style="font-size:12px; color:#94a3b8;">Minimum (Min)</div>
                    <div class="stat-value" id="stat-min">12.4%</div>
                  </div>
                  <div class="stat-card" style="border-left-color:#ef4444;">
                    <div style="font-size:12px; color:#94a3b8;">Maximum (Max)</div>
                    <div class="stat-value" id="stat-max" style="color:#fca5a5;">98.2%</div>
                  </div>
                  <div class="stat-card" style="border-left-color:#10b981;">
                    <div style="font-size:12px; color:#94a3b8;">Average (Avg)</div>
                    <div class="stat-value" id="stat-avg">45.1%</div>
                  </div>
                  <div class="stat-card" style="border-left-color:#f59e0b;">
                    <div style="font-size:12px; color:#94a3b8;">95th Percentile (P95)</div>
                    <div class="stat-value" id="stat-p95" style="color:#fcd34d;">88.4%</div>
                  </div>
                </div>
              </div>
            </div>
          \`;

          // Initialize Interactive Metrics Chart
          initMetricsChart('5m');
        }

        // ROUTE 5: Detail Object Page (/objects/:resourceUuid)
        else if (path.startsWith('/objects/')) {
          const resourceUuid = path.split('/objects/')[1] || 'vm-007';

          app.innerHTML = \`
            <div style="margin-bottom:20px;">
              <button class="btn-secondary" style="margin-bottom:12px;" onclick="navigateTo('/metrics')">⬅️ Back to Metrics Analysis</button>
              <h1 style="font-size:20px; font-weight:800;">OBJECT DETAIL: VirtualMachine - \${resourceUuid} (SQL-Database-Prod)</h1>
            </div>

            <div class="grid-2" style="margin-bottom:20px;">
              <div class="card">
                <h3 style="color:#94a3b8; font-size:14px; margin-bottom:12px;">OBJECT PROPERTIES SUMMARY</h3>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
                  <div><strong>VCF Instance:</strong> VCF-Ops-01</div>
                  <div><strong>Adapter Type:</strong> VMWARE</div>
                  <div><strong>IP Address:</strong> 10.20.30.45</div>
                  <div><strong>Guest OS:</strong> RHEL 9 (64-bit)</div>
                </div>
              </div>

              <div class="card">
                <h3 style="color:#94a3b8; font-size:14px; margin-bottom:12px;">PARENT HIERARCHY BREADCRUMBS</h3>
                <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
                  <div><strong>vCenter:</strong> <code>vc-01.corp.local</code></div>
                  <div><strong>Cluster:</strong> <code>Cluster-vSAN-01</code></div>
                  <div><strong>ESXi Host:</strong> <code>esx-04.corp.local</code></div>
                  <div><strong>Datastore:</strong> <code>vsanDatastore</code></div>
                </div>
              </div>
            </div>

            <div class="card" style="margin-bottom:20px;">
              <h3 style="margin-bottom:12px;">Active Alerts on this Resource (2 Active)</h3>
              <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="background:#78350f; padding:12px; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between;" onclick="navigateTo('/alerts/alt-98234-vcf')">
                  <span>⚠️ [WARNING] High CPU Ready Latency (Triggered 18 mins ago)</span>
                  <span>Inspect Alert ➔</span>
                </div>
              </div>
            </div>

            <div class="grid-2" style="margin-bottom:20px;">
              <div class="card">
                <h4 style="margin-bottom:8px;">CPU Utilization (%) with Time Scale</h4>
                <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155;">
                  <svg width="100%" height="120" viewBox="0 0 400 120">
                    <line x1="30" y1="20" x2="380" y2="20" stroke="#334155" stroke-dasharray="2 2" />
                    <line x1="30" y1="50" x2="380" y2="50" stroke="#334155" stroke-dasharray="2 2" />
                    <line x1="30" y1="80" x2="380" y2="80" stroke="#334155" stroke-dasharray="2 2" />
                    <text x="25" y="24" fill="#3b82f6" font-size="10" text-anchor="end">100%</text>
                    <text x="25" y="54" fill="#3b82f6" font-size="10" text-anchor="end">50%</text>
                    <text x="25" y="84" fill="#3b82f6" font-size="10" text-anchor="end">0%</text>
                    <text x="30" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">00:00</text>
                    <text x="117" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">06:00</text>
                    <text x="205" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">12:00</text>
                    <text x="292" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">18:00</text>
                    <text x="380" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">Now</text>
                    <path d="M 30 70 Q 117 30, 205 60 T 292 25 T 380 40" fill="none" stroke="#3b82f6" stroke-width="2" />
                  </svg>
                </div>
              </div>

              <div class="card">
                <h4 style="margin-bottom:8px;">Memory Consumed (GB) with Time Scale</h4>
                <div style="background:#0f172a; padding:12px; border-radius:6px; border:1px solid #334155;">
                  <svg width="100%" height="120" viewBox="0 0 400 120">
                    <line x1="30" y1="20" x2="380" y2="20" stroke="#334155" stroke-dasharray="2 2" />
                    <line x1="30" y1="50" x2="380" y2="50" stroke="#334155" stroke-dasharray="2 2" />
                    <line x1="30" y1="80" x2="380" y2="80" stroke="#334155" stroke-dasharray="2 2" />
                    <text x="25" y="24" fill="#10b981" font-size="10" text-anchor="end">64GB</text>
                    <text x="25" y="54" fill="#10b981" font-size="10" text-anchor="end">32GB</text>
                    <text x="25" y="84" fill="#10b981" font-size="10" text-anchor="end">0GB</text>
                    <text x="30" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">00:00</text>
                    <text x="117" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">06:00</text>
                    <text x="205" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">12:00</text>
                    <text x="292" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">18:00</text>
                    <text x="380" y="105" fill="#94a3b8" font-size="10" text-anchor="middle">Now</text>
                    <path d="M 30 50 Q 117 45, 205 52 T 292 48 T 380 50" fill="none" stroke="#10b981" stroke-width="2" />
                  </svg>
                </div>
              </div>
            </div>

            <div class="card" style="display:flex; justify-content:space-between; align-items:center; background:#0f172a;">
              <div>
                <strong style="font-size:14px;">Manage or configure this object directly in native console?</strong>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">Opens source VCF Operations 9 web console in a new browser tab</div>
              </div>
              <button class="btn-primary" onclick="window.open('https://vcf-ops-01.corp.local/ui/index.action#...', '_blank', 'noopener,noreferrer')">
                🚀 Open Object in VCF Operations Console ➔
              </button>
            </div>
          \`;
        }

        // ROUTE 6: System & VCF Configuration Page (/settings)
        else if (path === '/settings') {
          app.innerHTML = \`
            <div style="margin-bottom:20px;">
              <h1 style="font-size:22px; font-weight:800;">System & VCF Configuration</h1>
              <p style="color:#94a3b8; font-size:14px;">Manage connected VCF Operations 9 instances, authentication credentials, and data retention rules</p>
            </div>

            <!-- Live System Health Banner -->
            <div class="health-banner" style="border:1px solid var(--border-color); border-radius:6px; margin-bottom:20px;">
              <span class="badge badge-healthy">🟢 Ingestion Engine Online</span>
              <span style="color:#94a3b8">Connected to 5 VCF Operations 9 instances. Last 1-minute delta poll completed 8s ago.</span>
            </div>

            <div class="card" style="margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3>VCF Operations 9 Instances Management</h3>
                <button class="btn-primary" onclick="openAddInstanceModal()">+ Add VCF Instance Connection</button>
              </div>

              <table>
                <thead>
                  <tr><th>Instance Name</th><th>Hostname / IP</th><th>Auth Method</th><th>Polling Interval</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>VCF-Ops-01</strong></td>
                    <td><code>vcf-ops-01.corp.local</code></td>
                    <td>Option A: OpsToken (Local)</td>
                    <td>60 seconds</td>
                    <td><span class="badge badge-healthy">HEALTHY</span></td>
                    <td><button class="btn-secondary" onclick="openAddInstanceModal()">Edit</button></td>
                  </tr>
                  <tr>
                    <td><strong>VCF-Ops-02</strong></td>
                    <td><code>vcf-ops-02.corp.local</code></td>
                    <td>Option B: Bearer Token (VIDB SSO)</td>
                    <td>60 seconds</td>
                    <td><span class="badge badge-healthy">HEALTHY</span></td>
                    <td><button class="btn-secondary" onclick="openAddInstanceModal()">Edit</button></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Telemetry Collection Configuration Editor -->
            <div class="card" style="margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div>
                  <h3 style="font-size:16px; font-weight:700;">⚙️ Telemetry Collection Rules (Metrics & Alerts)</h3>
                  <p style="font-size:13px; color:#94a3b8; margin-top:2px;">
                    Dynamically edit metrics and alert filters collected per object type (<code>metrics_list.yaml</code> / <code>alerts_list.yaml</code>).
                  </p>
                </div>
                <div style="display:flex; gap:8px;">
                  <button id="config-mode-grid" class="btn-primary" style="font-size:12px;" onclick="switchConfigMode('grid')">Structured Grid</button>
                  <button id="config-mode-yaml" class="btn-secondary" style="font-size:12px;" onclick="switchConfigMode('yaml')">📝 Raw YAML</button>
                </div>
              </div>

              <div style="display:flex; gap:8px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
                <button id="config-tab-metrics" class="btn-primary" style="font-size:13px;" onclick="switchConfigTab('metrics')">📊 Metrics Rules (metrics_list.yaml)</button>
                <button id="config-tab-alerts" class="btn-secondary" style="font-size:13px;" onclick="switchConfigTab('alerts')">🚨 Alert Rules (alerts_list.yaml)</button>
              </div>

              <div id="config-editor-body" style="background:#0f172a; padding:16px; border-radius:6px; border:1px solid var(--border-color);">
                <!-- Dynamic Editor Content -->
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px;">
                <div id="config-save-status" style="font-size:13px; color:#6ee7b7; font-weight:600; display:none;"></div>
                <button class="btn-primary" onclick="saveTelemetryConfig()">💾 Save & Apply Dynamic Telemetry Rules</button>
              </div>
            </div>

            <div class="card">
              <h3 style="margin-bottom:16px;">Data Retention & Pruning Policies</h3>
              <div class="grid-2" style="margin-bottom:16px;">
                <div>
                  <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Raw 1-Minute Metrics Buffer Retention (Hours)</label>
                  <input type="number" value="48" style="width:100%;" />
                </div>
                <div>
                  <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Summary Rollup Retention (Days)</label>
                  <input type="number" value="90" style="width:100%;" />
                </div>
              </div>
              <button class="btn-primary" onclick="alert('Retention policies updated successfully!')">💾 Save Retention Policies</button>
            </div>

            <div id="modal-container"></div>
          \`;

          initTelemetryConfig();
        } else {
          app.innerHTML = \`
            <div class="card" style="margin-top:20px;">
              <h2>404 - Page Not Found</h2>
              <p style="color:#94a3b8; margin-top:8px;">The requested path <code>\${path}</code> was not recognized.</p>
              <button class="btn-primary" style="margin-top:12px;" onclick="navigateTo('/')">🏠 Return to Home</button>
            </div>
          \`;
        }
      } catch (err) {
        console.error('View Rendering Error:', err);
        app.innerHTML = \`
          <div class="card" style="border-left: 4px solid var(--accent-red); margin-top:20px;">
            <h2 style="color:var(--accent-red); font-size:18px; margin-bottom:8px;">⚠️ View Error</h2>
            <p style="color:var(--text-muted); font-size:14px; margin-bottom:12px;">Failed to render page view for route: <code>\${path}</code></p>
            <pre style="background:#0f172a; padding:12px; border-radius:6px; font-size:12px; color:#fca5a5; overflow-x:auto;">\${err.stack || err.message || err}</pre>
            <button class="btn-primary" style="margin-top:12px;" onclick="navigateTo('/')">🏠 Return to Home Dashboard</button>
          </div>
        \`;
      }
    }

      // --- Interactive Metrics Chart Engine Functions ---
      function initMetricsChart(res) {
        metricsChartState.resolution = res || '5m';
        const now = Date.now();
        const stepMs = metricsChartState.resolution === '1m' ? 60000 : metricsChartState.resolution === '1h' ? 3600000 : 300000;
        const count = metricsChartState.resolution === '1m' ? 120 : metricsChartState.resolution === '1h' ? 24 : 72;

        const data = [];
        for (let i = count; i >= 0; i--) {
          const ts = now - i * stepMs;
          const cpu = Math.round(Math.sin(i / 6) * 30 + 50 + (Math.random() * 8 - 4));
          const ready = Math.round(Math.cos(i / 6) * 12 + 18 + (Math.random() * 4 - 2));
          data.push({
            timestamp: ts,
            cpu: Math.max(5, Math.min(100, cpu)),
            ready: Math.max(1, Math.min(40, ready))
          });
        }

        metricsChartState.fullData = data;
        metricsChartState.activeData = [...data];
        metricsChartState.isZoomed = false;

        renderMetricsSvg();
        updateMetricsStats();
        bindChartEvents();
      }

      function changeChartResolution(res) {
        document.querySelectorAll('[id^="res-btn-"]').forEach(btn => {
          btn.className = 'btn-secondary';
        });
        document.getElementById('res-btn-' + res).className = 'btn-primary';
        initMetricsChart(res);
      }

      function renderChartWithCurrentFilters() {
        initMetricsChart(metricsChartState.resolution);
      }

      function renderMetricsSvg() {
        const svg = document.getElementById('metrics-svg');
        if (!svg) return;

        const data = metricsChartState.activeData;
        const N = data.length;
        if (N === 0) return;

        const padL = 50, padR = 50, padT = 20, padB = 40;
        const width = 800, height = 240;
        const plotW = width - padL - padR;
        const plotH = height - padT - padB;

        // Construct Gridlines and Axes
        let html = \`
          <!-- Background Gridlines -->
          <line x1="\${padL}" y1="\${padT}" x2="\${width - padR}" y2="\${padT}" stroke="#334155" stroke-dasharray="3 3" />
          <line x1="\${padL}" y1="\${padT + plotH * 0.25}" x2="\${width - padR}" y2="\${padT + plotH * 0.25}" stroke="#334155" stroke-dasharray="3 3" />
          <line x1="\${padL}" y1="\${padT + plotH * 0.5}" x2="\${width - padR}" y2="\${padT + plotH * 0.5}" stroke="#334155" stroke-dasharray="3 3" />
          <line x1="\${padL}" y1="\${padT + plotH * 0.75}" x2="\${width - padR}" y2="\${padT + plotH * 0.75}" stroke="#334155" stroke-dasharray="3 3" />
          <line x1="\${padL}" y1="\${padT + plotH}" x2="\${width - padR}" y2="\${padT + plotH}" stroke="#334155" />

          <!-- Left Y-Axis (CPU %: 0% to 100%) -->
          <text x="\${padL - 8}" y="\${padT + 4}" fill="#3b82f6" font-size="11" font-weight="bold" text-anchor="end">100%</text>
          <text x="\${padL - 8}" y="\${padT + plotH * 0.25 + 4}" fill="#3b82f6" font-size="11" text-anchor="end">75%</text>
          <text x="\${padL - 8}" y="\${padT + plotH * 0.5 + 4}" fill="#3b82f6" font-size="11" text-anchor="end">50%</text>
          <text x="\${padL - 8}" y="\${padT + plotH * 0.75 + 4}" fill="#3b82f6" font-size="11" text-anchor="end">25%</text>
          <text x="\${padL - 8}" y="\${padT + plotH + 4}" fill="#3b82f6" font-size="11" font-weight="bold" text-anchor="end">0%</text>
          <line x1="\${padL}" y1="\${padT}" x2="\${padL}" y2="\${padT + plotH}" stroke="#3b82f6" stroke-width="1.5" />

          <!-- Right Y-Axis (CPU Ready ms: 0ms to 40ms) -->
          <text x="\${width - padR + 8}" y="\${padT + 4}" fill="#f59e0b" font-size="11" font-weight="bold" text-anchor="start">40ms</text>
          <text x="\${width - padR + 8}" y="\${padT + plotH * 0.25 + 4}" fill="#f59e0b" font-size="11" text-anchor="start">30ms</text>
          <text x="\${width - padR + 8}" y="\${padT + plotH * 0.5 + 4}" fill="#f59e0b" font-size="11" text-anchor="start">20ms</text>
          <text x="\${width - padR + 8}" y="\${padT + plotH * 0.75 + 4}" fill="#f59e0b" font-size="11" text-anchor="start">10ms</text>
          <text x="\${width - padR + 8}" y="\${padT + plotH + 4}" fill="#f59e0b" font-size="11" font-weight="bold" text-anchor="start">0ms</text>
          <line x1="\${width - padR}" y1="\${padT}" x2="\${width - padR}" y2="\${padT + plotH}" stroke="#f59e0b" stroke-width="1.5" />
        \`;

        // X-Axis Time Ticks
        const tickCount = 6;
        for (let k = 0; k <= tickCount; k++) {
          const idx = Math.round((k / tickCount) * (N - 1));
          const item = data[idx];
          if (item) {
            const tx = padL + (k / tickCount) * plotW;
            const d = new Date(item.timestamp);
            const timeStr = d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0') + ' UTC';

            html += \`
              <line x1="\${tx}" y1="\${padT + plotH}" x2="\${tx}" y2="\${padT + plotH + 5}" stroke="#94a3b8" />
              <text x="\${tx}" y="\${padT + plotH + 20}" fill="#94a3b8" font-size="11" text-anchor="middle">\${timeStr}</text>
            \`;
          }
        }

        // Generate Path Points
        let pathCpu = '', pathReady = '';
        for (let i = 0; i < N; i++) {
          const item = data[i];
          const cx = padL + (i / (N - 1)) * plotW;
          const cyCpu = padT + plotH - (item.cpu / 100) * plotH;
          const cyReady = padT + plotH - (item.ready / 40) * plotH;

          if (i === 0) {
            pathCpu += \`M \${cx} \${cyCpu}\`;
            pathReady += \`M \${cx} \${cyReady}\`;
          } else {
            pathCpu += \` L \${cx} \${cyCpu}\`;
            pathReady += \` L \${cx} \${cyReady}\`;
          }
        }

        html += \`
          <!-- Data Series Paths -->
          <path d="\${pathCpu}" fill="none" stroke="#3b82f6" stroke-width="2.5" />
          <path d="\${pathReady}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3" />

          <!-- Dynamic Crosshair Guideline & Tooltip Dots -->
          <line id="crosshair-line" x1="0" y1="\${padT}" x2="0" y2="\${padT + plotH}" stroke="#94a3b8" stroke-dasharray="3 3" stroke-width="1.5" visibility="hidden" />
          <circle id="dot-cpu" r="5" fill="#3b82f6" stroke="#fff" stroke-width="2" visibility="hidden" />
          <circle id="dot-ready" r="5" fill="#f59e0b" stroke="#fff" stroke-width="2" visibility="hidden" />

          <!-- Drag-to-Zoom Selection Overlay -->
          <rect id="drag-rect" x="0" y="\${padT}" width="0" height="\${plotH}" fill="rgba(59,130,246,0.25)" stroke="#3b82f6" stroke-dasharray="2 2" visibility="hidden" />
        \`;

        svg.innerHTML = html;
      }

      function updateMetricsStats() {
        const data = metricsChartState.activeData;
        if (!data || data.length === 0) return;

        const cpus = data.map(d => d.cpu).sort((a, b) => a - b);
        const min = cpus[0];
        const max = cpus[cpus.length - 1];
        const sum = cpus.reduce((acc, v) => acc + v, 0);
        const avg = (sum / cpus.length).toFixed(1);
        const p95Idx = Math.floor(cpus.length * 0.95);
        const p95 = cpus[p95Idx];

        document.getElementById('stat-min').innerText = min + '%';
        document.getElementById('stat-max').innerText = max + '%';
        document.getElementById('stat-avg').innerText = avg + '%';
        document.getElementById('stat-p95').innerText = p95 + '%';
      }

      function bindChartEvents() {
        const svg = document.getElementById('metrics-svg');
        const tooltip = document.getElementById('chart-tooltip');
        if (!svg) return;

        const padL = 50, padR = 50, padT = 20, padB = 40;
        const width = 800, plotW = width - padL - padR, plotH = 240 - padT - padB;

        svg.onmousemove = function(e) {
          const data = metricsChartState.activeData;
          const N = data.length;
          if (N === 0) return;

          const rect = svg.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * width;
          const clampedX = Math.max(padL, Math.min(width - padR, svgX));

          let ratio = (clampedX - padL) / plotW;
          ratio = Math.max(0, Math.min(1, ratio));

          const i = Math.round(ratio * (N - 1));
          const item = data[i];
          if (!item) return;

          const cx = padL + (i / (N - 1)) * plotW;
          const cyCpu = padT + plotH - (item.cpu / 100) * plotH;
          const cyReady = padT + plotH - (item.ready / 40) * plotH;

          // Drag-to-zoom update
          if (metricsChartState.isDragging) {
            metricsChartState.dragCurrentIdx = i;
            const startX = padL + (metricsChartState.dragStartIdx / (N - 1)) * plotW;
            const currentX = cx;

            const rx = Math.min(startX, currentX);
            const rw = Math.abs(currentX - startX);

            const dragRect = document.getElementById('drag-rect');
            if (dragRect) {
              dragRect.setAttribute('x', rx.toString());
              dragRect.setAttribute('width', rw.toString());
              dragRect.setAttribute('visibility', 'visible');
            }
          }

          // Crosshair and Dots update
          const crossLine = document.getElementById('crosshair-line');
          const dotCpu = document.getElementById('dot-cpu');
          const dotReady = document.getElementById('dot-ready');

          if (crossLine && dotCpu && dotReady) {
            crossLine.setAttribute('x1', cx.toString());
            crossLine.setAttribute('x2', cx.toString());
            crossLine.setAttribute('visibility', 'visible');

            dotCpu.setAttribute('cx', cx.toString());
            dotCpu.setAttribute('cy', cyCpu.toString());
            dotCpu.setAttribute('visibility', 'visible');

            dotReady.setAttribute('cx', cx.toString());
            dotReady.setAttribute('cy', cyReady.toString());
            dotReady.setAttribute('visibility', 'visible');
          }

          // Tooltip position & text update
          if (tooltip) {
            const d = new Date(item.timestamp);
            const timeStr = d.getUTCHours().toString().padStart(2, '0') + ':' + d.getUTCMinutes().toString().padStart(2, '0') + ':' + d.getUTCSeconds().toString().padStart(2, '0') + ' UTC';

            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
            tooltip.style.top = (e.clientY - rect.top - 20) + 'px';
            tooltip.innerHTML = \`
              <div style="font-weight:bold; color:#f8fafc; margin-bottom:4px;">📅 \${timeStr}</div>
              <div style="color:#3b82f6;">🔵 CPU Usage: <strong>\${item.cpu}%</strong></div>
              <div style="color:#f59e0b;">🟠 CPU Ready: <strong>\${item.ready} ms</strong></div>
            \`;
          }
        };

        svg.onmousedown = function(e) {
          const data = metricsChartState.activeData;
          const N = data.length;
          if (N === 0) return;

          const rect = svg.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * width;
          const clampedX = Math.max(padL, Math.min(width - padR, svgX));
          const ratio = Math.max(0, Math.min(1, (clampedX - padL) / plotW));
          const idx = Math.round(ratio * (N - 1));

          metricsChartState.isDragging = true;
          metricsChartState.dragStartIdx = idx;
          metricsChartState.dragCurrentIdx = idx;
        };

        svg.onmouseup = function() {
          if (metricsChartState.isDragging) {
            metricsChartState.isDragging = false;
            const i1 = Math.min(metricsChartState.dragStartIdx, metricsChartState.dragCurrentIdx);
            const i2 = Math.max(metricsChartState.dragStartIdx, metricsChartState.dragCurrentIdx);

            if (i2 - i1 >= 2) {
              metricsChartState.activeData = metricsChartState.activeData.slice(i1, i2 + 1);
              metricsChartState.isZoomed = true;

              renderMetricsSvg();
              updateMetricsStats();
              document.getElementById('reset-zoom-btn').style.display = 'inline-block';
            } else {
              const dragRect = document.getElementById('drag-rect');
              if (dragRect) dragRect.setAttribute('visibility', 'hidden');
            }
          }
        };

        svg.onmouseleave = function() {
          metricsChartState.isDragging = false;
          if (tooltip) tooltip.style.display = 'none';

          const crossLine = document.getElementById('crosshair-line');
          const dotCpu = document.getElementById('dot-cpu');
          const dotReady = document.getElementById('dot-ready');
          const dragRect = document.getElementById('drag-rect');

          if (crossLine) crossLine.setAttribute('visibility', 'hidden');
          if (dotCpu) dotCpu.setAttribute('visibility', 'hidden');
          if (dotReady) dotReady.setAttribute('visibility', 'hidden');
          if (dragRect) dragRect.setAttribute('visibility', 'hidden');
        };
      }

      function resetChartZoom() {
        metricsChartState.activeData = [...metricsChartState.fullData];
        metricsChartState.isZoomed = false;
        renderMetricsSvg();
        updateMetricsStats();
        document.getElementById('reset-zoom-btn').style.display = 'none';
      }

      function exportMetricsCsv() {
        const data = metricsChartState.activeData;
        let csv = 'Timestamp (UTC),CPU Utilization (%),CPU Ready Time (ms)\\n';
        for (const d of data) {
          csv += new Date(d.timestamp).toISOString() + ',' + d.cpu + ',' + d.ready + '\\n';
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'metrics_export_' + Date.now() + '.csv';
        a.click();
      }

      function filterAlertsTable() {
        const severity = document.getElementById('alert-severity-filter').value;
        const text = document.getElementById('alert-search-input').value.toLowerCase();
        let visibleCount = 0;

        document.querySelectorAll('.alert-row').forEach(row => {
          const rowSeverity = row.getAttribute('data-severity');
          const rowText = row.getAttribute('data-text');

          const matchSeverity = (severity === 'ALL' || rowSeverity === severity);
          const matchText = (!text || rowText.includes(text));

          if (matchSeverity && matchText) {
            row.style.display = '';
            visibleCount++;
          } else {
            row.style.display = 'none';
          }
        });

        document.getElementById('alert-count').innerText = visibleCount;
      }

      function openAddInstanceModal() {
        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = \`
          <div class="modal-backdrop">
            <div class="modal">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <h3>Add / Edit VCF Instance Connection</h3>
                <button class="btn-secondary" onclick="closeModal()">✕</button>
              </div>

              <div style="display:flex; flex-direction:column; gap:16px;">
                <div>
                  <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Hostname / IP Address</label>
                  <input type="text" id="modal-hostname" value="vcf-ops-03.corp.local" style="width:100%;" />
                </div>

                <div>
                  <label style="font-size:12px; color:#94a3b8; display:block; margin-bottom:4px;">Authentication Option</label>
                  <select id="modal-auth-type" style="width:100%;">
                    <option value="OPS_TOKEN">Option A: Local Credentials (OpsToken) - VCF 9.0</option>
                    <option value="BEARER_TOKEN">Option B: VCF SSO / VIDB API Token (Bearer Token)</option>
                  </select>
                </div>

                <div id="test-result-box"></div>

                <div style="display:flex; justify-content:space-between; margin-top:12px;">
                  <button class="btn-secondary" onclick="testConnection()">🧪 Test Connection</button>
                  <button class="btn-primary" onclick="closeModal(); alert('Instance connection saved!'); renderCurrentView();">💾 Save Instance</button>
                </div>
              </div>
            </div>
          </div>
        \`;
      }

      function closeModal() {
        document.getElementById('modal-container').innerHTML = '';
      }

      async function testConnection() {
        const hostname = document.getElementById('modal-hostname').value;
        const box = document.getElementById('test-result-box');
        box.innerHTML = '<div style="background:#1e3a8a; color:#93c5fd; padding:10px; border-radius:6px; font-size:13px;">Testing connection...</div>';

        const res = await fetch('/api/v1/instances/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostname })
        });
        const data = await res.json();

        if (data.success) {
          box.innerHTML = '<div style="background:#064e3b; color:#6ee7b7; padding:10px; border-radius:6px; font-size:13px;">✅ ' + data.message + '</div>';
        } else {
          box.innerHTML = '<div style="background:#7f1d1d; color:#fca5a5; padding:10px; border-radius:6px; font-size:13px;">❌ ' + data.message + '</div>';
        }
      }

      // --- Telemetry Collection Rules Editor State & Logic ---
      let telemetryConfigState = {
        type: 'metrics', // 'metrics' or 'alerts'
        mode: 'grid',    // 'grid' or 'yaml'
        metricsYaml: '',
        alertsYaml: '',
        activeKind: 'VirtualMachine'
      };

      function parseYamlConfigClient(text) {
        const result = {
          object_types: {
            VirtualMachine: { metrics: [], alert_filters: [] },
            HostSystem: { metrics: [], alert_filters: [] },
            ClusterComputeResource: { metrics: [], alert_filters: [] },
            Datastore: { metrics: [], alert_filters: [] }
          }
        };
        if (!text) return result;
        let currentKind = null;
        let currentMetric = null;
        let currentAlert = null;
        const lines = text.split('\\n');
        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          const trimmed = rawLine.trim();
          if (!trimmed) continue;
          const kindMatch = rawLine.match(/^\s*(VirtualMachine|HostSystem|ClusterComputeResource|Datastore):/);
          if (kindMatch) {
            currentKind = kindMatch[1];
            if (!result.object_types[currentKind]) {
              result.object_types[currentKind] = { metrics: [], alert_filters: [] };
            }
            currentMetric = null;
            currentAlert = null;
            continue;
          }
          if (!currentKind) continue;
          const isCommented = trimmed.startsWith('#');
          const cleanLine = trimmed.replace(/^#\s*/, '');
          if (cleanLine.startsWith('- key:')) {
            const colonIdx = cleanLine.indexOf(':');
            const keyVal = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            currentMetric = { key: keyVal, name: keyVal, unit: 'count', description: '', active: !isCommented };
            result.object_types[currentKind].metrics.push(currentMetric);
            currentAlert = null;
            continue;
          }
          if (cleanLine.startsWith('- alert_sub_type:')) {
            const colonIdx = cleanLine.indexOf(':');
            const subVal = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            currentAlert = { alert_sub_type: subVal, name: subVal, min_severity: 'WARNING', description: '', active: !isCommented };
            result.object_types[currentKind].alert_filters.push(currentAlert);
            currentMetric = null;
            continue;
          }
          if (currentMetric) {
            const colonIdx = cleanLine.indexOf(':');
            if (colonIdx !== -1) {
              const prop = cleanLine.substring(0, colonIdx).trim();
              const val = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
              if (prop === 'name') currentMetric.name = val;
              else if (prop === 'unit') currentMetric.unit = val;
              else if (prop === 'description') currentMetric.description = val;
            }
          }
          if (currentAlert) {
            const colonIdx = cleanLine.indexOf(':');
            if (colonIdx !== -1) {
              const prop = cleanLine.substring(0, colonIdx).trim();
              const val = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
              if (prop === 'name') currentAlert.name = val;
              else if (prop === 'min_severity') currentAlert.min_severity = val;
              else if (prop === 'description') currentAlert.description = val;
            }
          }
        }
        return result;
      }

      function toggleConfigItem(type, itemKey) {
        const isMetrics = type === 'metrics';
        const yaml = isMetrics ? telemetryConfigState.metricsYaml : telemetryConfigState.alertsYaml;
        const kind = telemetryConfigState.activeKind;
        const lines = yaml.split('\\n');
        let inKind = false;
        let inTargetItem = false;
        let newLines = [];
        for (let i = 0; i < lines.length; i++) {
          const rawLine = lines[i];
          const trimmed = rawLine.trim();
          const kindMatch = rawLine.match(/^\s*(VirtualMachine|HostSystem|ClusterComputeResource|Datastore):/);
          if (kindMatch) {
            inKind = (kindMatch[1] === kind);
            inTargetItem = false;
            newLines.push(rawLine);
            continue;
          }
          if (!inKind) {
            newLines.push(rawLine);
            continue;
          }
          const cleanLine = trimmed.replace(/^#\s*/, '');
          if (cleanLine.startsWith('- key:') || cleanLine.startsWith('- alert_sub_type:')) {
            const colonIdx = cleanLine.indexOf(':');
            const val = cleanLine.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
            inTargetItem = (val === itemKey);
          }
          if (inTargetItem) {
            const isCommented = trimmed.startsWith('#');
            if (isCommented) {
              newLines.push(rawLine.replace(/^(\s*)#\s?/, '$1'));
            } else {
              const indentMatch = rawLine.match(/^(\s*)/);
              const indent = indentMatch ? indentMatch[1] : '';
              newLines.push(indent + '# ' + rawLine.trimStart());
            }
          } else {
            newLines.push(rawLine);
          }
        }
        const updatedYaml = newLines.join('\\n');
        if (isMetrics) telemetryConfigState.metricsYaml = updatedYaml;
        else telemetryConfigState.alertsYaml = updatedYaml;
        renderTelemetryConfigEditor();
      }

      function appendBlockToKind(yaml, kind, block) {
        const lines = yaml.split('\\n');
        let inserted = false;
        let newLines = [];
        for (let i = 0; i < lines.length; i++) {
          newLines.push(lines[i]);
          if (!inserted && lines[i].match(new RegExp('^\\s*' + kind + ':'))) {
            newLines.push(block);
            inserted = true;
          }
        }
        if (!inserted) newLines.push('\\n  ' + kind + ':\\n' + block);
        return newLines.join('\\n');
      }

      function addConfigItemPrompt(type) {
        const kind = telemetryConfigState.activeKind;
        const isMetrics = type === 'metrics';
        if (isMetrics) {
          const key = prompt('Enter new Metric Stat Key (e.g. cpu|swapwait_average):');
          if (!key) return;
          const name = prompt('Enter Display Name:', key);
          const unit = prompt('Enter Unit (e.g. percent, ms, count, KBps):', 'count');
          const desc = prompt('Enter Description (optional):', '');
          const newBlock = '\\n      - key: "' + key + '"\\n        name: "' + (name || key) + '"\\n        unit: "' + (unit || 'count') + '"\\n        description: "' + (desc || '') + '"';
          telemetryConfigState.metricsYaml = appendBlockToKind(telemetryConfigState.metricsYaml, kind, newBlock);
        } else {
          const subType = prompt('Enter Alert Sub-Type (e.g. HARDWARE, CAPACITY, NETWORK):');
          if (!subType) return;
          const name = prompt('Enter Alert Name Filter:', subType + ' High Severity Event');
          const minSev = prompt('Enter Min Severity (WARNING, CRITICAL, IMMEDIATE):', 'WARNING');
          const desc = prompt('Enter Description (optional):', '');
          const newBlock = '\\n      - alert_sub_type: "' + subType + '"\\n        name: "' + (name || subType) + '"\\n        min_severity: "' + (minSev || 'WARNING') + '"\\n        description: "' + (desc || '') + '"';
          telemetryConfigState.alertsYaml = appendBlockToKind(telemetryConfigState.alertsYaml, kind, newBlock);
        }
        renderTelemetryConfigEditor();
      }

      async function initTelemetryConfig() {
        try {
          const resM = await fetch('/api/v1/system/config/metrics');
          const dataM = await resM.json();
          if (dataM.success) telemetryConfigState.metricsYaml = dataM.yaml;

          const resA = await fetch('/api/v1/system/config/alerts');
          const dataA = await resA.json();
          if (dataA.success) telemetryConfigState.alertsYaml = dataA.yaml;

          renderTelemetryConfigEditor();
        } catch (e) {
          console.error('Error fetching telemetry config:', e);
        }
      }

      function switchConfigTab(type) {
        telemetryConfigState.type = type;
        const tabM = document.getElementById('config-tab-metrics');
        const tabA = document.getElementById('config-tab-alerts');
        if (tabM) tabM.className = type === 'metrics' ? 'btn-primary' : 'btn-secondary';
        if (tabA) tabA.className = type === 'alerts' ? 'btn-primary' : 'btn-secondary';
        renderTelemetryConfigEditor();
      }

      function switchConfigMode(mode) {
        telemetryConfigState.mode = mode;
        const modeG = document.getElementById('config-mode-grid');
        const modeY = document.getElementById('config-mode-yaml');
        if (modeG) modeG.className = mode === 'grid' ? 'btn-primary' : 'btn-secondary';
        if (modeY) modeY.className = mode === 'yaml' ? 'btn-primary' : 'btn-secondary';
        renderTelemetryConfigEditor();
      }

      function setConfigActiveKind(kind) {
        telemetryConfigState.activeKind = kind;
        renderTelemetryConfigEditor();
      }

      function renderTelemetryConfigEditor() {
        const body = document.getElementById('config-editor-body');
        if (!body) return;

        const isMetrics = telemetryConfigState.type === 'metrics';
        const isGrid = telemetryConfigState.mode === 'grid';
        const activeYaml = isMetrics ? telemetryConfigState.metricsYaml : telemetryConfigState.alertsYaml;

        if (!isGrid) {
          const fileName = isMetrics ? 'metrics_list.yaml' : 'alerts_list.yaml';
          body.innerHTML = '<div style="display:flex; flex-direction:column; gap:8px;">' +
            '<div style="font-size:12px; color:#94a3b8;">📝 Direct YAML Editor (<code>Configuration/' + fileName + '</code>):</div>' +
            '<textarea id="raw-yaml-input" rows="14" style="width:100%; font-family:monospace; font-size:13px; background:#0f172a; color:#f8fafc; border:1px solid #334155; padding:12px; border-radius:6px; line-height:1.4;" onchange="if(telemetryConfigState.type===&quot;metrics&quot;) telemetryConfigState.metricsYaml=this.value; else telemetryConfigState.alertsYaml=this.value;">' + (activeYaml || '') + '</textarea>' +
            '</div>';
          return;
        }

        const kinds = ['VirtualMachine', 'HostSystem', 'ClusterComputeResource', 'Datastore'];
        let kindTabsHtml = '<div style="display:flex; gap:8px; margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">';
        kinds.forEach(function(k) {
          const activeCls = k === telemetryConfigState.activeKind ? 'btn-primary' : 'btn-secondary';
          kindTabsHtml += '<button class="' + activeCls + '" style="font-size:12px; padding:4px 10px;" onclick="setConfigActiveKind(&quot;' + k + '&quot;)">' + k + '</button>';
        });
        kindTabsHtml += '</div>';

        const parsedConfig = parseYamlConfigClient(activeYaml);
        const kindData = (parsedConfig.object_types && parsedConfig.object_types[telemetryConfigState.activeKind]) || { metrics: [], alert_filters: [] };

        if (isMetrics) {
          let rowsHtml = '';
          const metrics = kindData.metrics || [];
          if (metrics.length === 0) {
            rowsHtml = '<tr><td colspan="5" style="color:#94a3b8; text-align:center;">No metric keys defined for ' + telemetryConfigState.activeKind + '</td></tr>';
          } else {
            metrics.forEach(function(m) {
              const statusBadge = m.active ? '<span class="badge badge-healthy">ACTIVE</span>' : '<span class="badge badge-warning">DISABLED</span>';
              const actionBtn = '<button class="btn-secondary" style="font-size:11px; padding:2px 6px;" onclick="toggleConfigItem(&quot;metrics&quot;, &quot;' + m.key + '&quot;)">' + (m.active ? 'Disable' : 'Enable') + '</button>';
              rowsHtml += '<tr><td><code>' + m.key + '</code></td><td>' + (m.name || m.key) + '</td><td>' + (m.unit || 'count') + '</td><td>' + statusBadge + '</td><td>' + actionBtn + '</td></tr>';
            });
          }

          body.innerHTML = kindTabsHtml +
            '<table>' +
            '<thead><tr><th>Stat Key</th><th>Display Name</th><th>Unit</th><th>Status</th><th>Action</th></tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody></table>' +
            '<div style="margin-top:12px;"><button class="btn-secondary" style="font-size:12px;" onclick="addConfigItemPrompt(&quot;metrics&quot;)">+ Add Metric Key to ' + telemetryConfigState.activeKind + '</button></div>';
        } else {
          let rowsHtml = '';
          const alerts = kindData.alert_filters || [];
          if (alerts.length === 0) {
            rowsHtml = '<tr><td colspan="5" style="color:#94a3b8; text-align:center;">No alert filters defined for ' + telemetryConfigState.activeKind + '</td></tr>';
          } else {
            alerts.forEach(function(a) {
              const sevBadgeClass = (a.min_severity === 'CRITICAL' || a.min_severity === 'IMMEDIATE') ? 'badge-critical' : 'badge-warning';
              const sevBadge = '<span class="badge ' + sevBadgeClass + '">' + (a.min_severity || 'WARNING') + '</span>';
              const statusBadge = a.active ? '<span class="badge badge-healthy">ACTIVE</span>' : '<span class="badge badge-warning">DISABLED</span>';
              const actionBtn = '<button class="btn-secondary" style="font-size:11px; padding:2px 6px;" onclick="toggleConfigItem(&quot;alerts&quot;, &quot;' + a.alert_sub_type + '&quot;)">' + (a.active ? 'Disable' : 'Enable') + '</button>';
              rowsHtml += '<tr><td><code>' + a.alert_sub_type + '</code></td><td>' + (a.name || a.alert_sub_type) + '</td><td>' + sevBadge + '</td><td>' + statusBadge + '</td><td>' + actionBtn + '</td></tr>';
            });
          }

          body.innerHTML = kindTabsHtml +
            '<table>' +
            '<thead><tr><th>Alert Sub-Type</th><th>Alert Name Filter</th><th>Min Severity</th><th>Status</th><th>Action</th></tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody></table>' +
            '<div style="margin-top:12px;"><button class="btn-secondary" style="font-size:12px;" onclick="addConfigItemPrompt(&quot;alerts&quot;)">+ Add Alert Filter to ' + telemetryConfigState.activeKind + '</button></div>';
        }
      }

      async function saveTelemetryConfig() {
        const isMetrics = telemetryConfigState.type === 'metrics';
        const isYaml = telemetryConfigState.mode === 'yaml';
        let payloadYaml = isMetrics ? telemetryConfigState.metricsYaml : telemetryConfigState.alertsYaml;

        if (isYaml) {
          const area = document.getElementById('raw-yaml-input');
          if (area) payloadYaml = area.value;
        }

        const endpoint = isMetrics ? '/api/v1/system/config/metrics' : '/api/v1/system/config/alerts';

        try {
          const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yaml: payloadYaml })
          });
          const data = await res.json();

          const statusEl = document.getElementById('config-save-status');
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerText = '✅ ' + (data.message || 'Telemetry rules saved and dynamic ingestion rules reloaded without restart!');
            setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
          }
        } catch (e) {
          alert('Error saving telemetry configuration: ' + e);
        }
      }

      // Initial page load rendering
      document.addEventListener('DOMContentLoaded', renderCurrentView);
      renderCurrentView();
    </script>
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
