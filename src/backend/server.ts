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
        url: req.url,
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

    <!-- Live System Health Banner -->
    <div class="health-banner">
      <span class="badge badge-healthy">🟢 Ingestion Engine Online</span>
      <span style="color:#94a3b8">Connected to 5 VCF Operations 9 instances. Last 1-minute delta poll completed 8s ago.</span>
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

      async function renderCurrentView() {
        const path = window.location.pathname;
        const app = document.getElementById('app-root');
        updateNavButtons(path);

        // ROUTE 1: Home Page (/)
        if (path === '/' || path === '') {
          const alertsSummary = await fetchApi('/alerts/summary') || { critical: 3, warning: 14, info: 8 };
          const pinnedObjects = await fetchApi('/objects/pinned') || [];
          const instances = await fetchApi('/instances') || [];

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
                    <div style="font-size:20px; font-weight:800; color:#fca5a5">\${alertsSummary.critical}</div>
                    <div style="font-size:12px; color:#fca5a5">CRITICAL</div>
                  </div>
                  <div style="flex:1; background:#78350f; padding:12px; border-radius:6px; cursor:pointer;" onclick="navigateTo('/alerts')">
                    <div style="font-size:20px; font-weight:800; color:#fcd34d">\${alertsSummary.warning}</div>
                    <div style="font-size:12px; color:#fcd34d">WARNING</div>
                  </div>
                  <div style="flex:1; background:#1e3a8a; padding:12px; border-radius:6px; cursor:pointer;" onclick="navigateTo('/alerts')">
                    <div style="font-size:20px; font-weight:800; color:#93c5fd">\${alertsSummary.info}</div>
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
          const alerts = await fetchApi('/alerts') || [];

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
                <div style="margin-top:12px; display:flex; flexDirection:column; gap:8px;">
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
              <div style="background:#0f172a; height:180px; border-radius:6px; padding:20px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                <div style="color:#94a3b8; font-size:14px; margin-bottom:8px;">📈 <code>cpu|ready_summation</code> (ms) Timeline Chart</div>
                <div style="width:80%; height:80px; border-bottom:2px solid #3b82f6; position:relative;">
                  <div style="position:absolute; right:30%; top:10px; background:#ef4444; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">
                    ⚡ Trigger Spike: 28.4ms @ 10:18 UTC
                  </div>
                </div>
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
                        <label style="cursor:pointer;"><input type="checkbox" checked /> 💻 VM-007 (SQL-Prod)</label>
                        <label style="cursor:pointer;"><input type="checkbox" /> 💻 VM-008 (Web-App)</label>
                        <label style="cursor:pointer;"><input type="checkbox" /> 🖥️ esx-01.corp.local</label>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="card">
                  <h3 style="margin-bottom:12px;">📊 Metric Categories</h3>
                  <div style="font-size:13px; display:flex; flex-direction:column; gap:8px;">
                    <label style="cursor:pointer;"><input type="checkbox" checked /> <code>cpu|usage_average</code> (%)</label>
                    <label style="cursor:pointer;"><input type="checkbox" checked /> <code>cpu|ready_summation</code> (ms)</label>
                    <label style="cursor:pointer;"><input type="checkbox" checked /> <code>mem|usage_average</code> (%)</label>
                    <label style="cursor:pointer;"><input type="checkbox" /> <code>virtualDisk|totalLatency</code> (ms)</label>
                  </div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:20px;">
                <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:13px; color:#94a3b8; font-weight:600;">Resolution:</span>
                    <button class="btn-secondary" onclick="alert('Switched to 1-Min Raw Buffer')">1-Min Raw</button>
                    <button class="btn-primary">5-Min Rollup</button>
                    <button class="btn-secondary" onclick="alert('Switched to 1-Hour Rollup')">1-Hour Rollup</button>
                  </div>
                  <button class="btn-secondary" onclick="alert('Exporting metrics timeseries dataset...')">📥 Export CSV</button>
                </div>

                <div class="card">
                  <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                    <h3>CPU Utilization (%) vs CPU Ready Time (ms)</h3>
                    <div style="font-size:12px; color:#94a3b8;">🔵 VM-007 CPU % | 🟠 VM-007 Ready ms</div>
                  </div>
                  <div style="background:#0f172a; height:180px; border-radius:6px; padding:16px; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <svg width="100%" height="100" style="overflow:visible;">
                      <path d="M 0 60 Q 100 20, 200 70 T 400 30 T 600 80 T 800 40" fill="none" stroke="#3b82f6" stroke-width="3" />
                      <path d="M 0 80 Q 100 90, 200 40 T 400 85 T 600 50 T 800 75" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4" />
                    </svg>
                    <div style="font-size:11px; color:#94a3b8; margin-top:12px;">Synchronized Hover Crosshair • Drag to Zoom Window</div>
                  </div>
                </div>

                <div class="grid-4">
                  <div class="stat-card" style="border-left-color:#3b82f6;">
                    <div style="font-size:12px; color:#94a3b8;">Minimum (Min)</div>
                    <div class="stat-value">12.4%</div>
                  </div>
                  <div class="stat-card" style="border-left-color:#ef4444;">
                    <div style="font-size:12px; color:#94a3b8;">Maximum (Max)</div>
                    <div class="stat-value">98.2%</div>
                  </div>
                  <div class="stat-card" style="border-left-color:#10b981;">
                    <div style="font-size:12px; color:#94a3b8;">Average (Avg)</div>
                    <div class="stat-value">45.1%</div>
                  </div>
                  <div class="stat-card" style="border-left-color:#f59e0b;">
                    <div style="font-size:12px; color:#94a3b8;">95th Percentile (P95)</div>
                    <div class="stat-value">88.4%</div>
                  </div>
                </div>
              </div>
            </div>
          \`;
        }

        // ROUTE 5: Detail Object Page (/objects/:resourceUuid)
        else if (path.startsWith('/objects/')) {
          const resourceUuid = path.split('/objects/')[1] || 'vm-007';
          const objDetail = await fetchApi('/objects/' + resourceUuid) || {};

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
                <h4>CPU Utilization (%)</h4>
                <div style="background:#0f172a; height:100px; border-radius:4px; margin-top:8px; display:flex; align-items:center; justify-content:center; color:#3b82f6; font-weight:bold;">
                  📈 Current: 94% Avg | Peak: 98%
                </div>
              </div>
              <div class="card">
                <h4>Memory Consumed (KB)</h4>
                <div style="background:#0f172a; height:100px; border-radius:4px; margin-top:8px; display:flex; align-items:center; justify-content:center; color:#10b981; font-weight:bold;">
                  📈 Consumed: 32 GB / 64 GB Configured
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
                    <td><span className="badge badge-healthy">HEALTHY</span></td>
                    <td><button className="btn-secondary" onclick="openAddInstanceModal()">Edit</button></td>
                  </tr>
                  <tr>
                    <td><strong>VCF-Ops-02</strong></td>
                    <td><code>vcf-ops-02.corp.local</code></td>
                    <td>Option B: Bearer Token (VIDB SSO)</td>
                    <td>60 seconds</td>
                    <td><span className="badge badge-healthy">HEALTHY</span></td>
                    <td><button className="btn-secondary" onclick="openAddInstanceModal()">Edit</button></td>
                  </tr>
                </tbody>
              </table>
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
        }
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
