import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';

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
