import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import '../../src/backend/server.ts';

test('REST API Gateway Integration Tests - healthz endpoint', async () => {
  const res = await fetch('http://localhost:3000/healthz');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ok');
});

test('REST API Gateway Integration Tests - readyz endpoint', async () => {
  const res = await fetch('http://localhost:3000/readyz');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, 'ready');
});

test('REST API Gateway Integration Tests - alerts API endpoint', async () => {
  const res = await fetch('http://localhost:3000/api/v1/alerts');
  assert.strictEqual(res.status, 200);
  const alerts = await res.json();
  assert.ok(Array.isArray(alerts));
  assert.ok(alerts.length > 0);
});

test('REST API Gateway Integration Tests - metrics query API endpoint', async () => {
  const res = await fetch('http://localhost:3000/api/v1/metrics/query');
  assert.strictEqual(res.status, 200);
  const metrics = await res.json();
  assert.ok(Array.isArray(metrics));
  assert.ok(metrics.length > 0);
});

test('REST API Gateway Integration Tests - system config metrics API', async () => {
  const res = await fetch('http://localhost:3000/api/v1/system/config/metrics');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(typeof data.yaml === 'string');
  assert.ok(data.config && typeof data.config === 'object');
  assert.ok(data.config.object_types.VirtualMachine.metrics.length >= 9);
  assert.ok(data.config.object_types.HostSystem.metrics.length >= 5);
  assert.ok(data.config.object_types.ClusterComputeResource.metrics.length >= 5);
  assert.ok(data.config.object_types.Datastore.metrics.length >= 5);
});

test('REST API Gateway Integration Tests - system config alerts API', async () => {
  const res = await fetch('http://localhost:3000/api/v1/system/config/alerts');
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(typeof data.yaml === 'string');
  assert.ok(data.config && typeof data.config === 'object');
  assert.ok(data.config.object_types.VirtualMachine.alert_filters.length >= 4);
  assert.ok(data.config.object_types.HostSystem.alert_filters.length >= 4);
  assert.ok(data.config.object_types.ClusterComputeResource.alert_filters.length >= 3);
  assert.ok(data.config.object_types.Datastore.alert_filters.length >= 3);
});

// --- SPA HTML Route Rendering Tests ---

const spaRoutes = [
  '/',
  '/alerts',
  '/alerts/alt-98234-vcf',
  '/metrics',
  '/objects/vm-007',
  '/settings'
];

for (const route of spaRoutes) {
  test(`SPA Route HTML Integrity Test - Route ${route}`, async () => {
    const res = await fetch(`http://localhost:3000${route}`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    
    // Verify core SPA container and header elements
    assert.ok(html.includes('<div class="container" id="app-root"></div>'), `Route ${route} missing app-root div`);
    assert.ok(html.includes('Federated VCF Operations'), `Route ${route} missing brand title`);
    assert.ok(html.includes('async function renderCurrentView()'), `Route ${route} missing SPA controller script`);
  });
}

// --- Test 17: Client JavaScript AST Compilation & Syntax Validation ---

test('Test 17: Client JavaScript AST Compilation Test - JS Script Syntax Verification', async () => {
  const res = await fetch('http://localhost:3000/');
  assert.strictEqual(res.status, 200);
  const html = await res.text();

  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'HTML response must contain a <script> tag');

  const jsCode = scriptMatch[1];
  assert.ok(jsCode.length > 100, 'Script block must contain executable JavaScript code');

  // Verify that the browser script compiles cleanly without syntax errors
  assert.doesNotThrow(() => {
    new vm.Script(jsCode);
  }, 'Client-side script in HTML must compile with zero JavaScript syntax errors');
});

// --- Test 18: Telemetry Configuration API & Dynamic Object Kind Grid Rendering ---

test('Test 18: Dynamic Telemetry Configuration API & YAML Grid Rendering Verification', async () => {
  const res = await fetch('http://localhost:3000/settings');
  assert.strictEqual(res.status, 200);
  const html = await res.text();

  assert.ok(html.includes('parseYamlConfigClient'), 'HTML must include client-side YAML parser function');
  assert.ok(html.includes('toggleConfigItem'), 'HTML must include toggleConfigItem function');
  assert.ok(html.includes('addConfigItemPrompt'), 'HTML must include addConfigItemPrompt function');

  // Verify client AST compilation for settings page HTML script
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Settings HTML response must contain a script block');
  const jsCode = scriptMatch[1];
  assert.doesNotThrow(() => {
    new vm.Script(jsCode);
  }, 'Settings page client script must compile with zero AST syntax errors');

  // Functional End-to-End DOM Mock Execution: Verify all 4 object tabs render rows dynamically
  const elements: Record<string, any> = {};
  function makeEl(id: string) {
    if (!elements[id]) {
      elements[id] = {
        id,
        innerHTML: '',
        innerText: '',
        style: {},
        className: '',
        value: '',
        classList: { add: () => {}, remove: () => {} }
      };
    }
    return elements[id];
  }

  const domContext = {
    console: console,
    fetch: (url: string, opts?: any) => {
      const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
      return fetch(fullUrl, opts);
    },
    document: {
      getElementById: (id: string) => makeEl(id),
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    location: { pathname: '/settings' },
    window: {} as any,
    prompt: () => 'test',
    alert: () => {},
    setTimeout: (fn: any) => fn(),
    setInterval: () => {}
  };
  domContext.window = domContext;
  domContext.window.location = domContext.location;

  const script = new vm.Script(jsCode);
  const context = vm.createContext(domContext);
  script.runInContext(context);

  // Initialize telemetry config from API
  await (context as any).initTelemetryConfig();

  const kinds = ['VirtualMachine', 'HostSystem', 'ClusterComputeResource', 'Datastore'];

  // Verify Metrics Grid Rendering for all 4 object kinds
  for (const k of kinds) {
    (context as any).setConfigActiveKind(k);
    const bodyHtml = makeEl('config-editor-body').innerHTML;
    const rowMatches = bodyHtml.match(/<tr>/g) || [];
    const dataRowCount = rowMatches.length - 1; // subtract <thead> row
    assert.ok(dataRowCount > 0, `Expected metrics rows for kind '${k}' to be > 0, but got ${dataRowCount}`);
  }

  // Verify metric toggle functionality on HostSystem
  (context as any).setConfigActiveKind('HostSystem');
  (context as any).toggleConfigItem('metrics', 'cpu|usage_average');
  const bodyAfterToggle = makeEl('config-editor-body').innerHTML;
  assert.ok(bodyAfterToggle.includes('DISABLED'), 'Expected HostSystem cpu|usage_average to display DISABLED badge after toggle');

  // Verify Alert Rules Grid Rendering for all 4 object kinds
  (context as any).switchConfigTab('alerts');
  for (const k of kinds) {
    (context as any).setConfigActiveKind(k);
    const alertBodyHtml = makeEl('config-editor-body').innerHTML;
    const rowMatches = alertBodyHtml.match(/<tr>/g) || [];
    const dataRowCount = rowMatches.length - 1;
    assert.ok(dataRowCount > 0, `Expected alert filter rows for kind '${k}' to be > 0, but got ${dataRowCount}`);
  }
});

// --- Test 19: Real Instance Mutation & Dynamic Settings Table DOM Test ---

test('Test 19: VCF Instance Real State Mutation & Dynamic Settings Table Rendering', async () => {
  const testId = `vcf-test-${Date.now()}`;
  const testName = 'VCF-Test-Instance';
  const testHost = 'vcf-test-host.corp.local';

  // 1. Mutate: Insert a new VCF instance into backend SQLite
  const postRes = await fetch('http://localhost:3000/api/v1/instances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: testName, hostname: testHost, authType: 'OPS_TOKEN' })
  });
  assert.strictEqual(postRes.status, 201, 'POST /api/v1/instances must return 201 Created');

  // 2. Execute: Fetch instances list from REST API
  const getRes = await fetch('http://localhost:3000/api/v1/instances');
  assert.strictEqual(getRes.status, 200);
  const instances = await getRes.json();
  const created = instances.find((i: any) => i.hostname === testHost);
  assert.ok(created, `Created instance with host ${testHost} must exist in GET /instances API response`);

  // 3. Assert DOM Rendering: Execute /settings view in virtual DOM
  const pageRes = await fetch('http://localhost:3000/settings');
  const html = await pageRes.text();
  const jsCode = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';

  const elements: Record<string, any> = {};
  function makeEl(id: string) {
    if (!elements[id]) {
      elements[id] = { id, innerHTML: '', innerText: '', style: {}, classList: { add: () => {}, remove: () => {} } };
    }
    return elements[id];
  }

  const domContext = {
    console,
    fetch: (url: string, opts?: any) => fetch(url.startsWith('http') ? url : `http://localhost:3000${url}`, opts),
    document: { getElementById: (id: string) => makeEl(id), querySelectorAll: () => [], addEventListener: () => {} },
    location: { pathname: '/settings' },
    window: {} as any,
    setTimeout: (fn: any) => fn(),
    setInterval: () => {}
  };
  domContext.window = domContext;
  domContext.window.location = domContext.location;

  const script = new vm.Script(jsCode);
  const context = vm.createContext(domContext);
  script.runInContext(context);

  await (context as any).renderCurrentView();
  const appHtml = makeEl('app-root').innerHTML;
  assert.ok(appHtml.includes(testHost), `Rendered /settings HTML must dynamically contain created host ${testHost}`);

  // Clean up test instance
  await fetch(`http://localhost:3000/api/v1/instances/${created.id}`, { method: 'DELETE' });
});

// --- Test 20: Real Active Alerts Query & Dynamic Alerts Analysis DOM Test ---

test('Test 20: Active Alerts Real Query & Dynamic Alerts Workspace Rendering', async () => {
  const alertsRes = await fetch('http://localhost:3000/api/v1/alerts');
  assert.strictEqual(alertsRes.status, 200);
  const alerts = await alertsRes.json();
  assert.ok(alerts.length >= 4, 'Database must contain at least 4 seeded alerts');

  const pageRes = await fetch('http://localhost:3000/alerts');
  const html = await pageRes.text();
  const jsCode = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';

  const elements: Record<string, any> = {};
  function makeEl(id: string) {
    if (!elements[id]) {
      elements[id] = { id, innerHTML: '', innerText: '', style: {}, classList: { add: () => {}, remove: () => {} } };
    }
    return elements[id];
  }

  const domContext = {
    console,
    fetch: (url: string, opts?: any) => fetch(url.startsWith('http') ? url : `http://localhost:3000${url}`, opts),
    document: { getElementById: (id: string) => makeEl(id), querySelectorAll: () => [], addEventListener: () => {} },
    location: { pathname: '/alerts' },
    window: {} as any,
    setTimeout: (fn: any) => fn(),
    setInterval: () => {}
  };
  domContext.window = domContext;
  domContext.window.location = domContext.location;

  const script = new vm.Script(jsCode);
  const context = vm.createContext(domContext);
  script.runInContext(context);

  await (context as any).renderCurrentView();
  const appHtml = makeEl('app-root').innerHTML;
  assert.ok(appHtml.includes('VM-007 (SQL-Prod)'), 'Rendered /alerts HTML must dynamically include VM-007 target resource');
  assert.ok(appHtml.includes('alt-98234-vcf'), 'Rendered /alerts HTML must dynamically include alert ID alt-98234-vcf');
});

// --- Test 21: Real Metrics Timeseries Query & SVG Chart State Initialization Test ---

test('Test 21: SQLite Raw Metrics Timeseries Query & SVG Chart State Test', async () => {
  const metricsRes = await fetch('http://localhost:3000/api/v1/metrics/query?resourceUuid=vm-007&statKeys=cpu|usage_average,cpu|ready_summation');
  assert.strictEqual(metricsRes.status, 200);
  const points = await metricsRes.json();
  assert.ok(points.length >= 70, 'SQLite raw_metrics query must return seeded timeseries points');

  const pageRes = await fetch('http://localhost:3000/metrics');
  const html = await pageRes.text();
  const jsCode = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';

  const elements: Record<string, any> = {};
  function makeEl(id: string) {
    if (!elements[id]) {
      elements[id] = { id, innerHTML: '', innerText: '', style: {}, classList: { add: () => {}, remove: () => {} } };
    }
    return elements[id];
  }

  const domContext = {
    console,
    fetch: (url: string, opts?: any) => fetch(url.startsWith('http') ? url : `http://localhost:3000${url}`, opts),
    document: { getElementById: (id: string) => makeEl(id), querySelectorAll: () => [], addEventListener: () => {} },
    location: { pathname: '/metrics' },
    window: {} as any,
    setTimeout: (fn: any) => fn(),
    setInterval: () => {}
  };
  domContext.window = domContext;
  domContext.window.location = domContext.location;

  const script = new vm.Script(jsCode);
  const context = vm.createContext(domContext);
  script.runInContext(context);

  await (context as any).initMetricsChart('5m');
  const state = (context as any).metricsChartState;
  assert.ok(state.fullData.length >= 70, 'metricsChartState.fullData must be populated directly from SQLite REST API query');
  assert.ok(typeof state.fullData[0].cpu === 'number', 'First timeseries point must contain numerical CPU metric');
  assert.ok(typeof state.fullData[0].ready === 'number', 'First timeseries point must contain numerical CPU Ready metric');
});

