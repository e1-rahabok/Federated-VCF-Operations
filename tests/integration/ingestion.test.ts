import { afterAll, beforeAll, expect, test } from 'vitest';
import { PollingScheduler } from '../../src/backend/ingestion/scheduler.ts';
import { getDatabase } from '../../src/backend/db/database.ts';
import { VcfOpsStub } from '../helpers/vcfOpsStub.ts';
import { startTestApp } from '../helpers/testApp.ts';

/**
 * Full data lifecycle: records exist only in the VCF Operations stub, are pulled by the
 * real client through the real scheduler into SQLite, and are then read back through the
 * REST API. Each step mutates the source and asserts the change arrives downstream.
 */

const stub = new VcfOpsStub();
// Properties and relationships are refreshed on every cycle here so tests can observe changes.
const scheduler = new PollingScheduler(60, { inventoryDetailRefreshSeconds: 0 });
let app: Awaited<ReturnType<typeof startTestApp>>;
const t0 = Date.now();

beforeAll(async () => {
  await stub.start();
  app = await startTestApp();

  stub.resources = [
    { identifier: 'uuid-vm-1', name: 'sql-prod-01', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-vm-2', name: 'web-app-01', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-host-1', name: 'esx-01.lab.local', resourceKind: 'HostSystem' },
    { identifier: 'uuid-ds-1', name: 'vsan-ds-01', resourceKind: 'Datastore' },
    { identifier: 'uuid-ds-2', name: 'nfs-ds-02', resourceKind: 'Datastore' },
    // Present in the source inventory but not a kind this application tracks:
    { identifier: 'uuid-vc-1', name: 'vc-01.lab.local', resourceKind: 'VMwareAdapter Instance' },
    { identifier: 'uuid-dc-1', name: 'DC-East', resourceKind: 'Datacenter' }
  ];
  stub.relations = [
    { parent: 'uuid-vc-1', child: 'uuid-dc-1' },
    { parent: 'uuid-dc-1', child: 'uuid-host-1' },
    { parent: 'uuid-host-1', child: 'uuid-vm-1' },
    { parent: 'uuid-host-1', child: 'uuid-vm-2' },
    { parent: 'uuid-vm-1', child: 'uuid-ds-1' }
  ];
  stub.properties = {
    'uuid-vm-1': { 'summary|guest|ipAddress': '10.20.30.45', 'summary|guest|fullName': 'Red Hat Enterprise Linux 9 (64-bit)', 'config|hardware|numCpu': 8 },
    'uuid-host-1': { 'summary|version': '9.1.0', 'net|mgmt_address': '10.20.0.11' }
  };
  stub.alertConditions = {
    'alert-cpu': [{ symptomId: 'sym-ready', key: 'cpu|readyPct', operator: 'GT', value: '10', severity: 'CRITICAL' }]
  };
  stub.samples = [
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: t0 - 60_000, value: 37.5 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|ready_summation', timestamp: t0 - 60_000, value: 120 },
    { resourceId: 'uuid-host-1', statKey: 'mem|usage_average', timestamp: t0 - 60_000, value: 81.2 },
    // Not in metrics_list.yaml at all: never collected, only readable live from the source.
    { resourceId: 'uuid-vm-1', statKey: 'cpu|readyPct', timestamp: t0 - 120_000, value: 4.5 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|readyPct', timestamp: t0 - 60_000, value: 12.5 },
    // Not listed for HostSystem in metrics_list.yaml, so it must never be requested or stored.
    { resourceId: 'uuid-host-1', statKey: 'cpu|ready_summation', timestamp: t0 - 60_000, value: 9999 }
  ];
  stub.alerts = [
    { alertId: 'alert-cpu', resourceId: 'uuid-vm-1', alertLevel: 'CRITICAL', status: 'ACTIVE', alertDefinitionName: 'VM CPU contention is high', startTimeUTC: t0 - 600_000, updateTimeUTC: t0 - 600_000, cancelTimeUTC: 0 },
    { alertId: 'alert-snap', resourceId: 'uuid-vm-2', alertLevel: 'INFORMATION', status: 'ACTIVE', alertDefinitionName: 'Snapshot is older than 7 days', startTimeUTC: t0 - 300_000, updateTimeUTC: t0 - 300_000, cancelTimeUTC: 0 }
  ];
});

afterAll(async () => {
  await app.stop();
  await stub.stop();
});

test('Test Connection performs a real authenticated call and reports the remote version', async () => {
  const ok = await app.post('/instances/test', { hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: stub.password });
  expect(ok.status).toBe(200);
  expect(ok.body.success).toBe(true);
  expect(ok.body.message).toContain('VCF Operations 9.1.0');

  const badPassword = await app.post('/instances/test', { hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: 'nope' });
  expect(badPassword.status).toBe(502);
  expect(badPassword.body.success).toBe(false);
  expect(badPassword.body.message).toContain('401');

  const unreachable = await app.post('/instances/test', { hostname: 'http://127.0.0.1:1', authType: 'OPS_TOKEN', username: 'x', password: 'y' });
  expect(unreachable.status).toBe(502);
  expect(unreachable.body.success).toBe(false);
});

test('Registering an instance stores encrypted credentials and never returns them', async () => {
  const created = await app.post('/instances', {
    name: 'Lab East', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: stub.password
  });
  expect(created.status).toBe(201);
  expect(created.body.instanceId).toBe('lab-east');

  const row = getDatabase().prepare('SELECT password_encrypted FROM vcf_instances WHERE id = ?').get('lab-east');
  expect(row.password_encrypted).not.toContain(stub.password);
  expect(row.password_encrypted.split(':')).toHaveLength(3);

  const list = await app.get('/instances');
  const listed = list.body.find((i: any) => i.id === 'lab-east');
  expect(listed).toMatchObject({ name: 'Lab East', hostname: stub.url, authType: 'OPS_TOKEN', status: 'PENDING' });
  expect(JSON.stringify(list.body)).not.toContain('password');

  const missingHost = await app.post('/instances', { name: 'No Host' });
  expect(missingHost.status).toBe(400);
});

test('First polling cycle ingests resources, YAML-listed metrics and active alerts', async () => {
  await scheduler.executePollingCycle();

  const instance = (await app.get('/instances')).body.find((i: any) => i.id === 'lab-east');
  expect(instance.status).toBe('HEALTHY');
  expect(instance.lastPoll).toBeGreaterThanOrEqual(t0);

  // Resources
  const summary = await app.get('/objects/summary');
  expect(summary.body).toEqual({ total: 5, byKind: { VirtualMachine: 2, HostSystem: 1, Datastore: 2 } });

  const tree = await app.get('/objects/tree');
  const vmGroup = tree.body[0].kinds.find((k: any) => k.kind === 'VirtualMachine');
  expect(tree.body[0].name).toBe('Lab East');
  expect(vmGroup.resources).toEqual([{ id: 'uuid-vm-1', name: 'sql-prod-01' }, { id: 'uuid-vm-2', name: 'web-app-01' }]);

  // Metrics: exact values from the source
  const points = await app.get('/metrics/query?resourceUuid=uuid-vm-1&statKeys=cpu|usage_average,cpu|ready_summation');
  expect(points.body).toEqual([{ timestamp: t0 - 60_000, 'cpu|usage_average': 37.5, 'cpu|ready_summation': 120 }]);

  const keys = await app.get('/metrics/keys?resourceUuid=uuid-vm-1');
  expect(keys.body.map((k: any) => [k.statKey, k.name, k.unit])).toEqual([
    ['cpu|ready_summation', 'CPU Ready Time (ms)', 'milliseconds'],
    ['cpu|usage_average', 'CPU Usage (%)', 'percent']
  ]);

  // The stats request for hosts carried only HostSystem keys from metrics_list.yaml.
  const hostRequest = stub.requestsTo('/suite-api/api/resources/stats/query').find(r => r.body.resourceId.includes('uuid-host-1'))!;
  expect(hostRequest.body.statKey).toContain('mem|usage_average');
  expect(hostRequest.body.statKey).not.toContain('cpu|ready_summation');
  const hostKeys = await app.get('/metrics/keys?resourceUuid=uuid-host-1');
  expect(hostKeys.body.map((k: any) => k.statKey)).toEqual(['mem|usage_average']);

  // Alerts: joined to the resource catalogue, INFORMATION normalized to INFO
  const alerts = await app.get('/alerts');
  expect(alerts.body.map((a: any) => [a.alertId, a.severity, a.status, a.resourceName, a.resourceKind])).toEqual([
    ['alert-snap', 'INFO', 'ACTIVE', 'web-app-01', 'VirtualMachine'],
    ['alert-cpu', 'CRITICAL', 'ACTIVE', 'sql-prod-01', 'VirtualMachine']
  ]);
  expect((await app.get('/alerts/summary')).body).toEqual({ critical: 1, immediate: 0, warning: 0, info: 1 });

  const detail = await app.get('/alerts/alert-cpu');
  expect(detail.body).toMatchObject({
    alertName: 'VM CPU contention is high', instanceId: 'lab-east', instanceName: 'Lab East', startTime: t0 - 600_000
  });
});

test('Object detail carries properties and parent hierarchy collected from the source, and follows changes', async () => {
  const vm = (await app.get('/objects/uuid-vm-1')).body;

  // Order and display names come from metrics_list.yaml; numeric properties arrive as text.
  expect(vm.properties).toEqual([
    { key: 'summary|guest|ipAddress', name: 'IP Address', value: '10.20.30.45' },
    { key: 'summary|guest|fullName', name: 'Guest OS', value: 'Red Hat Enterprise Linux 9 (64-bit)' },
    { key: 'config|hardware|numCpu', name: 'vCPU Count', value: '8' }
  ]);
  expect(vm.hierarchy).toEqual([
    { label: 'vCenter', kind: 'VMwareAdapter Instance', uuid: 'uuid-vc-1', name: 'vc-01.lab.local', tracked: false },
    { label: 'Datacenter', kind: 'Datacenter', uuid: 'uuid-dc-1', name: 'DC-East', tracked: false },
    { label: 'ESXi Host', kind: 'HostSystem', uuid: 'uuid-host-1', name: 'esx-01.lab.local', tracked: true },
    { label: 'Datastore', kind: 'Datastore', uuid: 'uuid-ds-1', name: 'vsan-ds-01', tracked: true }
  ]);

  const host = (await app.get('/objects/uuid-host-1')).body;
  expect(host.properties).toEqual([
    { key: 'net|mgmt_address', name: 'Management IP Address', value: '10.20.0.11' },
    { key: 'summary|version', name: 'ESXi Version', value: '9.1.0' }
  ]);
  expect(host.hierarchy.map((h: any) => `${h.label}=${h.name}`)).toEqual(['vCenter=vc-01.lab.local', 'Datacenter=DC-East']);

  // The property request for VMs carried exactly the active VirtualMachine property keys from the YAML.
  const propertyRequest = stub.requestsTo('/suite-api/api/resources/properties/latest/query').find(r => r.body.resourceIds.includes('uuid-vm-1'))!;
  expect(propertyRequest.body.propertyKeys).toEqual(['summary|guest|ipAddress', 'summary|guest|fullName', 'summary|runtime|powerState', 'config|hardware|numCpu', 'config|hardware|memoryKB']);

  // Source changes: the VM gets a new address and moves to another datastore.
  stub.properties['uuid-vm-1']['summary|guest|ipAddress'] = '10.20.30.99';
  stub.relations = stub.relations.filter(e => !(e.parent === 'uuid-vm-1' && e.child === 'uuid-ds-1'));
  stub.relations.push({ parent: 'uuid-vm-1', child: 'uuid-ds-2' });
  await scheduler.executePollingCycle();

  const moved = (await app.get('/objects/uuid-vm-1')).body;
  expect(moved.properties[0]).toEqual({ key: 'summary|guest|ipAddress', name: 'IP Address', value: '10.20.30.99' });
  expect(moved.hierarchy.filter((h: any) => h.label === 'Datastore')).toEqual([
    { label: 'Datastore', kind: 'Datastore', uuid: 'uuid-ds-2', name: 'nfs-ds-02', tracked: true }
  ]);
});

test('Alert detail carries the triggering stat key and threshold; that metric is readable live from the source', async () => {
  const detail = (await app.get('/alerts/alert-cpu')).body;
  expect(detail.conditions).toEqual([{ statKey: 'cpu|readyPct', operator: 'GT', threshold: '10', severity: 'CRITICAL' }]);
  expect((await app.get('/alerts/alert-snap')).body.conditions).toEqual([]);

  // cpu|readyPct is not in metrics_list.yaml, so nothing is stored for it...
  const stored = getDatabase().prepare("SELECT count(*) as count FROM raw_metrics WHERE stat_key = 'cpu|readyPct'").get();
  expect(stored.count).toBe(0);

  // ...but the live endpoint reads it from the source instance on demand.
  stub.requests = [];
  const live = await app.get(`/metrics/live?instanceId=lab-east&resourceUuid=uuid-vm-1&statKeys=${encodeURIComponent('cpu|readyPct')}&startTime=${t0 - 3_600_000}&endTime=${t0}`);
  expect(live.status).toBe(200);
  expect(live.body).toEqual([
    { timestamp: t0 - 120_000, 'cpu|readyPct': 4.5 },
    { timestamp: t0 - 60_000, 'cpu|readyPct': 12.5 }
  ]);
  expect(stub.requestsTo('/suite-api/api/resources/stats/query')[0].body).toEqual({
    resourceId: ['uuid-vm-1'], statKey: ['cpu|readyPct'], begin: t0 - 3_600_000, end: t0
  });

  expect((await app.get('/metrics/live?instanceId=nope&resourceUuid=x&statKeys=a')).status).toBe(404);
  expect((await app.get('/metrics/live?instanceId=lab-east')).status).toBe(400);
});

test('Second cycle requests only the delta: new samples appear once, alert changes are applied', async () => {
  const t1 = Date.now();
  stub.requests = [];
  const tokensBefore = stub.tokensIssued;

  stub.samples.push({ resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: t1 - 1000, value: 91 });
  // alert-cpu is canceled at the source; a new host alert is raised.
  Object.assign(stub.alerts[0], { status: 'CANCELED', updateTimeUTC: t1 - 500, cancelTimeUTC: t1 - 500 });
  stub.alerts.push({ alertId: 'alert-mem', resourceId: 'uuid-host-1', alertLevel: 'IMMEDIATE', status: 'ACTIVE', alertDefinitionName: 'Host memory contention', startTimeUTC: t1 - 400, updateTimeUTC: t1 - 400, cancelTimeUTC: 0 });

  await scheduler.executePollingCycle();

  // Watermark: begin is one past the newest sample already stored.
  const vmRequest = stub.requestsTo('/suite-api/api/resources/stats/query').find(r => r.body.resourceId.includes('uuid-vm-1'))!;
  expect(vmRequest.body.begin).toBe(t0 - 60_000 + 1);
  // The cached token was reused; no new login.
  expect(stub.tokensIssued).toBe(tokensBefore);

  const points = await app.get('/metrics/query?resourceUuid=uuid-vm-1&statKeys=cpu|usage_average');
  expect(points.body).toEqual([
    { timestamp: t0 - 60_000, 'cpu|usage_average': 37.5 },
    { timestamp: t1 - 1000, 'cpu|usage_average': 91 }
  ]);

  const canceled = await app.get('/alerts/alert-cpu');
  expect(canceled.body).toMatchObject({ status: 'CANCELED', cancelTime: t1 - 500 });

  const active = await app.get('/alerts?status=ACTIVE');
  expect(active.body.map((a: any) => a.alertId).sort()).toEqual(['alert-mem', 'alert-snap']);
  expect((await app.get('/alerts/summary')).body).toEqual({ critical: 0, immediate: 1, warning: 0, info: 1 });

  const hostAlerts = await app.get('/alerts?resourceUuid=uuid-host-1');
  expect(hostAlerts.body).toHaveLength(1);
  expect(hostAlerts.body[0]).toMatchObject({ alertName: 'Host memory contention', resourceName: 'esx-01.lab.local', severity: 'IMMEDIATE' });
});

test('5-minute and 1-hour resolutions average the stored samples per aligned bucket', async () => {
  const raw = (await app.get('/metrics/query?resourceUuid=uuid-vm-1&statKeys=cpu|usage_average&resolution=1m')).body;
  const hourly = (await app.get('/metrics/query?resourceUuid=uuid-vm-1&statKeys=cpu|usage_average&resolution=1h')).body;

  const hourMs = 60 * 60 * 1000;
  const expected = new Map<number, number[]>();
  for (const p of raw) {
    const bucket = Math.floor(p.timestamp / hourMs) * hourMs;
    expected.set(bucket, [...(expected.get(bucket) || []), p['cpu|usage_average']]);
  }
  expect(hourly).toEqual(Array.from(expected.entries()).sort((a, b) => a[0] - b[0]).map(([timestamp, values]) => ({
    timestamp, 'cpu|usage_average': values.reduce((s, v) => s + v, 0) / values.length
  })));

  const bad = await app.get('/metrics/query?resourceUuid=uuid-vm-1&resolution=2d');
  expect(bad.status).toBe(400);
});

test('Disabling a metric through the config API stops it being requested on the next cycle', async () => {
  const current = (await app.get('/system/config/metrics')).body;
  expect(current.config.object_types.VirtualMachine.metrics.find((m: any) => m.key === 'cpu|ready_summation').active).toBe(true);

  const disabled = current.yaml.replace(
    /^(\s*)- key: "cpu\|ready_summation"\r?\n(\s*)name: "CPU Ready Time \(ms\)"\r?\n(\s*)unit: "milliseconds"/m,
    '$1# - key: "cpu|ready_summation"\n$2# name: "CPU Ready Time (ms)"\n$3# unit: "milliseconds"'
  );
  expect(disabled).not.toBe(current.yaml);
  const saved = await app.put('/system/config/metrics', { yaml: disabled });
  expect(saved.body.success).toBe(true);
  expect(saved.body.config.object_types.VirtualMachine.metrics.find((m: any) => m.key === 'cpu|ready_summation').active).toBe(false);

  stub.requests = [];
  await scheduler.executePollingCycle();
  const vmRequest = stub.requestsTo('/suite-api/api/resources/stats/query').find(r => r.body.resourceId.includes('uuid-vm-1'))!;
  expect(vmRequest.body.statKey).toContain('cpu|usage_average');
  expect(vmRequest.body.statKey).not.toContain('cpu|ready_summation');
});

test('A failing instance is marked ERROR while the healthy instance keeps collecting', async () => {
  await app.post('/instances', { name: 'Lab Broken', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: 'wrong-password' });

  const t2 = Date.now();
  stub.samples.push({ resourceId: 'uuid-vm-2', statKey: 'cpu|usage_average', timestamp: t2 - 1000, value: 12 });
  await scheduler.executePollingCycle();

  const instances = (await app.get('/instances')).body;
  const broken = instances.find((i: any) => i.id === 'lab-broken');
  expect(broken.status).toBe('ERROR');
  expect(broken.lastError).toContain('401');
  expect(instances.find((i: any) => i.id === 'lab-east').status).toBe('HEALTHY');

  const points = await app.get('/metrics/query?resourceUuid=uuid-vm-2&statKeys=cpu|usage_average');
  expect(points.body).toEqual([{ timestamp: t2 - 1000, 'cpu|usage_average': 12 }]);

  const status = (await app.get('/system/status')).body;
  expect(status.instances).toEqual({ total: 2, enabled: 2, healthy: 1 });
  expect(status.objects).toBe(5);
  expect(status.lastPoll).toBeGreaterThanOrEqual(t2);
});

test('A failing enrichment call marks the instance DEGRADED without losing metrics', async () => {
  const t3 = Date.now();
  stub.samples.push({ resourceId: 'uuid-vm-2', statKey: 'cpu|usage_average', timestamp: t3 - 500, value: 44 });
  stub.failingPaths.add('/suite-api/api/resources/bulk/relationships');
  await scheduler.executePollingCycle();

  const degraded = (await app.get('/instances')).body.find((i: any) => i.id === 'lab-east');
  expect(degraded.status).toBe('DEGRADED');
  expect(degraded.lastError).toContain('HTTP 500');
  const points = (await app.get('/metrics/query?resourceUuid=uuid-vm-2&statKeys=cpu|usage_average')).body;
  expect(points[points.length - 1]).toEqual({ timestamp: t3 - 500, 'cpu|usage_average': 44 });
  // Previously collected hierarchy is kept while the relationship call is failing.
  expect((await app.get('/objects/uuid-vm-1')).body.hierarchy.length).toBeGreaterThan(0);

  stub.failingPaths.clear();
  await scheduler.executePollingCycle();
  const recovered = (await app.get('/instances')).body.find((i: any) => i.id === 'lab-east');
  expect(recovered).toMatchObject({ status: 'HEALTHY', lastError: null });
});

test('Top-N ranking uses the latest stored sample of each object', async () => {
  const top = (await app.get(`/metrics/top?kind=VirtualMachine&statKey=${encodeURIComponent('cpu|usage_average')}&limit=10`)).body;
  expect(top).toMatchObject({ kind: 'VirtualMachine', statKey: 'cpu|usage_average', name: 'CPU Usage (%)', unit: 'percent', collected: true });
  expect(top.resources.map((r: any) => [r.resourceName, r.value])).toEqual([['sql-prod-01', 91], ['web-app-01', 44]]);

  const limited = (await app.get(`/metrics/top?kind=VirtualMachine&statKey=${encodeURIComponent('cpu|usage_average')}&limit=1`)).body;
  expect(limited.resources.map((r: any) => r.resourceName)).toEqual(['sql-prod-01']);

  const uncollected = (await app.get(`/metrics/top?kind=VirtualMachine&statKey=${encodeURIComponent('cpu|readyPct')}`)).body;
  expect(uncollected).toMatchObject({ collected: false, resources: [] });
  expect((await app.get('/metrics/top?kind=VirtualMachine')).status).toBe(400);
});

test('Saved retention is validated, persisted and enforced by the purge', async () => {
  expect((await app.get('/system/status')).body.retention).toEqual({ rawHours: 48, summaryDays: 90 });

  const tooShort = await app.put('/system/settings/retention', { rawHours: 5, summaryDays: 90 });
  expect(tooShort.status).toBe(400);
  expect(tooShort.body.error).toBe('rawHours must be a whole number between 12 and 168.');
  expect((await app.put('/system/settings/retention', { rawHours: 24, summaryDays: 400 })).status).toBe(400);
  expect((await app.get('/system/status')).body.retention).toEqual({ rawHours: 48, summaryDays: 90 });

  const hour = 60 * 60 * 1000;
  const now = Date.now();
  const db = getDatabase();
  const insertRaw = db.prepare("INSERT INTO raw_metrics (instance_id, resource_uuid, stat_key, timestamp, stat_value) VALUES ('lab-east', 'uuid-ds-1', 'retention|probe', ?, ?)");
  insertRaw.run(now - 30 * hour, 1);
  insertRaw.run(now - 11 * hour, 2);
  const insertSummary = db.prepare("INSERT INTO summary_metrics (instance_id, resource_uuid, stat_key, time_bucket, granularity, val_min, val_max, val_avg, val_p95, sample_count) VALUES ('lab-east', 'uuid-ds-1', 'retention|probe', ?, '5MIN', 1, 1, 1, 1, 1)");
  insertSummary.run(now - 45 * 24 * hour);
  insertSummary.run(now - 20 * 24 * hour);
  const probe = () => app.get(`/metrics/query?resourceUuid=uuid-ds-1&statKeys=${encodeURIComponent('retention|probe')}`);
  const summaryBuckets = () => db.prepare("SELECT time_bucket FROM summary_metrics WHERE stat_key = 'retention|probe' ORDER BY time_bucket").all().map((r: any) => r.time_bucket);

  // With the default 48 h / 90 d retention both probes survive a purge.
  await new PollingScheduler(60).executePollingCycle();
  expect((await probe()).body).toHaveLength(2);
  expect(summaryBuckets()).toHaveLength(2);

  const saved = await app.put('/system/settings/retention', { rawHours: 12, summaryDays: 30 });
  expect(saved.body).toEqual({ success: true, retention: { rawHours: 12, summaryDays: 30 } });
  expect((await app.get('/system/status')).body.retention).toEqual({ rawHours: 12, summaryDays: 30 });

  // The 30-hour-old sample and the 45-day-old rollup are now past retention.
  await new PollingScheduler(60).executePollingCycle();
  expect((await probe()).body).toEqual([{ timestamp: now - 11 * hour, 'retention|probe': 2 }]);
  expect(summaryBuckets()).toEqual([now - 20 * 24 * hour]);
});

test('Pinning persists in SQLite and the pinned list carries the latest ingested values', async () => {
  expect((await app.get('/objects/pinned')).body).toEqual([]);

  const saved = await app.put('/users/preferences', { pinnedObjects: [{ instanceId: 'lab-east', resourceUuid: 'uuid-vm-1' }], hiddenWidgets: ['INGESTION_STATUS'] });
  expect(saved.status).toBe(200);
  expect((await app.get('/users/preferences')).body).toEqual({
    hiddenWidgets: ['INGESTION_STATUS'],
    pinnedObjects: [{ instanceId: 'lab-east', resourceUuid: 'uuid-vm-1' }]
  });

  const pinned = (await app.get('/objects/pinned')).body;
  expect(pinned).toHaveLength(1);
  expect(pinned[0]).toMatchObject({ resourceName: 'sql-prod-01', resourceKind: 'VirtualMachine', instanceName: 'Lab East', activeAlerts: 0 });
  expect(pinned[0].latestMetrics.find((m: any) => m.statKey === 'cpu|usage_average').value).toBe(91);

  const detail = (await app.get('/objects/uuid-vm-1')).body;
  expect(detail.pinned).toBe(true);
  expect((await app.get('/objects/does-not-exist')).status).toBe(404);
});

test('Console URL is built from the stored instance hostname', async () => {
  const objectLink = await app.get('/instances/lab-east/console-url?objectUuid=uuid-vm-1');
  expect(objectLink.body.url).toBe(`${stub.url}/ui/index.action#/object/uuid-vm-1/summary`);

  const alertLink = await app.get('/instances/lab-east/console-url?objectUuid=uuid-vm-1&alertId=alert-cpu');
  expect(alertLink.body.url).toContain('/object/uuid-vm-1/alertsAndSymptoms/alerts/alert-cpu');

  expect((await app.get('/instances/unknown/console-url?objectUuid=x')).status).toBe(404);
});

test('Deleting an instance removes everything ingested from it', async () => {
  const deleted = await app.del('/instances/lab-east');
  expect(deleted.status).toBe(200);

  expect((await app.get('/objects/summary')).body.total).toBe(0);
  expect((await app.get('/alerts')).body).toEqual([]);
  expect((await app.get('/metrics/query?resourceUuid=uuid-vm-1')).body).toEqual([]);
  for (const table of ['resource_properties', 'resource_relations', 'alert_conditions']) {
    expect(getDatabase().prepare(`SELECT count(*) as count FROM ${table} WHERE instance_id = 'lab-east'`).get().count).toBe(0);
  }
  expect((await app.del('/instances/lab-east')).status).toBe(404);
});

test('Unknown API paths return JSON 404, health probes respond', async () => {
  expect((await app.get('/nope')).status).toBe(404);
  const health = await fetch(`${app.baseUrl}/healthz`);
  expect((await health.json()).status).toBe('ok');
  const ready = await fetch(`${app.baseUrl}/readyz`);
  expect((await ready.json()).status).toBe('ready');
});
