// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../src/frontend/App';
import { AlertsPage } from '../../src/frontend/pages/AlertsPage';
import { AlertDetailPage } from '../../src/frontend/pages/AlertDetailPage';
import { HomePage } from '../../src/frontend/pages/HomePage';
import { MetricsPage } from '../../src/frontend/pages/MetricsPage';
import { ObjectDetailPage } from '../../src/frontend/pages/ObjectDetailPage';
import { SettingsPage } from '../../src/frontend/pages/SettingsPage';
import { setApiBase, setAuthToken } from '../../src/frontend/api';
import { PollingScheduler } from '../../src/backend/ingestion/scheduler.ts';
import { getDatabase } from '../../src/backend/db/database.ts';
import { VcfOpsStub } from '../helpers/vcfOpsStub.ts';
import { startTestApp, TEST_ADMIN } from '../helpers/testApp.ts';

/**
 * The React pages are rendered in a DOM against the real application server. Every value
 * asserted here originated in the VCF Operations stub, travelled through the real client,
 * scheduler and SQLite, and reached the DOM through the REST API.
 */

const stub = new VcfOpsStub();
const scheduler = new PollingScheduler(60, { inventoryDetailRefreshSeconds: 0 });
let app: Awaited<ReturnType<typeof startTestApp>>;
const t0 = Date.now();
const navigations: string[] = [];
const pageProps = { onNavigate: (path: string) => { navigations.push(path); }, instanceId: 'ALL', timeRange: '24h' };

beforeAll(async () => {
  await stub.start();
  app = await startTestApp();
  setApiBase(app.baseUrl);
  setAuthToken(app.token);

  stub.resources = [
    { identifier: 'uuid-vm-1', name: 'sql-prod-01', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-vm-2', name: 'web-app-01', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-host-1', name: 'esx-01.lab.local', resourceKind: 'HostSystem' },
    { identifier: 'uuid-ds-1', name: 'vsan-ds-01', resourceKind: 'Datastore' },
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
    'uuid-vm-1': { 'summary|guest|ipAddress': '10.20.30.45', 'summary|guest|fullName': 'Red Hat Enterprise Linux 9 (64-bit)' }
  };
  stub.alertConditions = {
    'alert-cpu': [{ symptomId: 'sym-ready', key: 'cpu|readyPct', operator: 'GT', value: '10', severity: 'CRITICAL' }]
  };
  stub.samples = [
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: t0 - 90_000, value: 20 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: t0 - 60_000, value: 40 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: t0 - 30_000, value: 90 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|ready_summation', timestamp: t0 - 90_000, value: 150 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|ready_summation', timestamp: t0 - 60_000, value: 300 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|ready_summation', timestamp: t0 - 30_000, value: 1250 },
    { resourceId: 'uuid-vm-2', statKey: 'cpu|ready_summation', timestamp: t0 - 30_000, value: 80 },
    { resourceId: 'uuid-host-1', statKey: 'cpu|usage_average', timestamp: t0 - 30_000, value: 55 },
    // Not in metrics_list.yaml: only reachable through the live source query.
    { resourceId: 'uuid-vm-1', statKey: 'cpu|readyPct', timestamp: t0 - 90_000, value: 3 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|readyPct', timestamp: t0 - 30_000, value: 14 }
  ];
  stub.alerts = [
    { alertId: 'alert-cpu', resourceId: 'uuid-vm-1', alertLevel: 'CRITICAL', status: 'ACTIVE', alertDefinitionName: 'VM CPU contention is high', startTimeUTC: t0 - 45_000, updateTimeUTC: t0 - 45_000, cancelTimeUTC: 0 },
    { alertId: 'alert-snap', resourceId: 'uuid-vm-2', alertLevel: 'INFORMATION', status: 'ACTIVE', alertDefinitionName: 'Snapshot is older than 7 days', startTimeUTC: t0 - 300_000, updateTimeUTC: t0 - 300_000, cancelTimeUTC: 0 }
  ];

  await app.post('/instances', { name: 'Lab East', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: stub.password });
  await scheduler.executePollingCycle();
});

afterEach(() => {
  cleanup();
  navigations.length = 0;
});

afterAll(async () => {
  await app.stop();
  await stub.stop();
});

test('Alerts page: table, severity distribution and timeline reflect ingested alerts and follow source changes', async () => {
  const view = render(<AlertsPage {...pageProps} />);

  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(2));
  const rows = screen.getAllByTestId('alert-row');
  expect(within(rows[0]).getByText('VM CPU contention is high')).toBeTruthy();
  expect(within(rows[0]).getByText('sql-prod-01')).toBeTruthy();
  expect(within(rows[0]).getByText('CRITICAL')).toBeTruthy();
  expect(within(rows[1]).getByText('Snapshot is older than 7 days')).toBeTruthy();
  expect(within(rows[1]).getByText('INFO')).toBeTruthy();

  await waitFor(() => expect(screen.getByTestId('severity-CRITICAL').textContent).toContain('1 (50%)'));
  expect(screen.getByTestId('severity-INFO').textContent).toContain('1 (50%)');
  expect(screen.getByTestId('severity-WARNING').textContent).toContain('0 (0%)');

  await waitFor(() => expect(screen.getAllByTestId('timeline-bucket')).toHaveLength(12));
  const bucketTotals = screen.getAllByTestId('timeline-bucket').map(b => Number(b.getAttribute('data-total')));
  expect(bucketTotals.reduce((a, b) => a + b, 0)).toBe(2);

  // Server-side severity filter
  fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'INFO' } });
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(1));
  expect(screen.getByText('Snapshot is older than 7 days')).toBeTruthy();
  expect(screen.queryByText('VM CPU contention is high')).toBeNull();

  // Row click navigates to the alert
  fireEvent.click(screen.getByTestId('alert-row'));
  expect(navigations).toEqual(['/alerts/alert-snap']);

  // A new alert raised at the source appears after the next polling cycle.
  const t1 = Date.now();
  stub.alerts.push({ alertId: 'alert-mem', resourceId: 'uuid-host-1', alertLevel: 'WARNING', status: 'ACTIVE', alertDefinitionName: 'Host memory contention', startTimeUTC: t1 - 100, updateTimeUTC: t1 - 100, cancelTimeUTC: 0 });
  await scheduler.executePollingCycle();
  view.unmount();
  render(<AlertsPage {...pageProps} />);
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));
  expect(screen.getByText('Host memory contention')).toBeTruthy();
  expect(within(screen.getAllByTestId('alert-row')[0]).getByText('esx-01.lab.local')).toBeTruthy();
});

test('Home page: KPI cards and top alert come from SQLite; hiding a widget is saved and restored', async () => {
  const view = render(<HomePage {...pageProps} />);

  await waitFor(() => expect(screen.getByTestId('alert-count-critical').textContent).toContain('1'));
  expect(screen.getByTestId('alert-count-warning').textContent).toContain('1');
  expect(screen.getByTestId('alert-count-info').textContent).toContain('1');
  await waitFor(() => expect(screen.getByText('Total Monitored Objects').parentElement!.parentElement!.textContent).toContain('4'));
  await waitFor(() => expect(screen.getByTestId('widget-ACTIVE_ALERTS').textContent).toContain('Top Alert: VM CPU contention is high on sql-prod-01'));
  await waitFor(() => expect(screen.getByTestId('widget-INGESTION_STATUS').textContent).toContain('Lab East'));
  expect(screen.getByTestId('widget-INGESTION_STATUS').textContent).toContain('HEALTHY');

  // Quick Metrics Launcher: live rankings from the latest ingested samples
  const vmLauncher = screen.getByTestId('launcher-vm-cpu-ready');
  await waitFor(() => expect(within(vmLauncher).getAllByTestId('launcher-row')).toHaveLength(2));
  expect(within(vmLauncher).getAllByTestId('launcher-row').map(r => r.textContent)).toEqual(['1. sql-prod-011250 ms', '2. web-app-0180 ms']);
  expect(vmLauncher.textContent).toContain('CPU Ready Time (ms)');
  await waitFor(() => expect(screen.getByTestId('launcher-host-cpu').textContent).toContain('1. esx-01.lab.local55%'));
  await waitFor(() => expect(screen.getByTestId('launcher-datastore-usage').textContent).toContain('No samples collected yet.'));
  fireEvent.click(within(vmLauncher).getAllByTestId('launcher-row')[1]);
  expect(navigations).toEqual(['/objects/uuid-vm-2']);

  fireEvent.click(screen.getByText('✏️ Customize Dashboard'));
  fireEvent.click(within(screen.getByTestId('widget-INGESTION_STATUS')).getByText('Hide widget'));
  fireEvent.click(screen.getByText('💾 Save Layout Preference'));
  await waitFor(() => expect(screen.getByText(/Dashboard layout preferences saved/)).toBeTruthy());
  expect(screen.queryByTestId('widget-INGESTION_STATUS')).toBeNull();

  expect((await app.get('/users/preferences')).body.hiddenWidgets).toEqual(['INGESTION_STATUS']);
  const stored = getDatabase().prepare("SELECT layout_json FROM user_preferences WHERE username = 'admin'").get();
  expect(JSON.parse(stored.layout_json).hiddenWidgets).toEqual(['INGESTION_STATUS']);

  // A fresh mount restores the saved layout.
  view.unmount();
  render(<HomePage {...pageProps} />);
  await waitFor(() => expect(screen.getByTestId('widget-ACTIVE_ALERTS').textContent).toContain('Top Alert'));
  await waitFor(() => expect(screen.queryByTestId('widget-INGESTION_STATUS')).toBeNull());

  await app.put('/users/preferences', { hiddenWidgets: [] });
});

test('Metrics page: resource tree, chart series and statistics are built from the ingested samples', async () => {
  const { container } = render(<MetricsPage {...pageProps} />);

  const vmRadio = await waitFor(() => screen.getByLabelText('sql-prod-01'));
  expect(screen.getByText('📁 Lab East')).toBeTruthy();
  expect(screen.getByLabelText('esx-01.lab.local')).toBeTruthy();

  // Tree search narrows the list
  fireEvent.change(screen.getByLabelText('Search resources'), { target: { value: 'esx' } });
  expect(screen.queryByLabelText('sql-prod-01')).toBeNull();
  fireEvent.change(screen.getByLabelText('Search resources'), { target: { value: '' } });

  fireEvent.click(screen.getByLabelText('sql-prod-01'));
  await waitFor(() => expect(screen.getByLabelText(/CPU Usage \(%\)/)).toBeTruthy());
  expect(screen.getByLabelText(/CPU Ready Time \(ms\)/)).toBeTruthy();

  // Raw resolution: one chart point per ingested sample, on a dual-axis chart.
  fireEvent.click(screen.getByText('Raw Samples'));
  await waitFor(() => expect(container.querySelectorAll('circle[data-point="cpu|usage_average"]')).toHaveLength(3));
  expect(container.querySelectorAll('circle[data-point="cpu|ready_summation"]')).toHaveLength(3);
  expect(container.querySelector('path[data-series="cpu|usage_average"]')!.getAttribute('d')).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  const legends = screen.getAllByTestId('chart-legend').map(l => l.textContent);
  expect(legends).toEqual(['● CPU Ready Time (ms) (left axis)', '● CPU Usage (%) (right axis)']);

  // The highest CPU sample (90) is drawn at the top of its 0-100 axis range: y = 20 + 180 * (1 - 0.9) = 38
  const cpuYs = Array.from(container.querySelectorAll('circle[data-point="cpu|usage_average"]')).map(c => Number(c.getAttribute('cy')));
  expect(cpuYs.map(y => Math.round(y))).toEqual([164, 128, 38]);

  // Statistics follow the selected key
  fireEvent.change(screen.getByLabelText('Statistics for:'), { target: { value: 'cpu|usage_average' } });
  const card = (label: string) => screen.getByText(label).parentElement!.parentElement!.textContent;
  await waitFor(() => expect(card('Maximum (Max)')).toContain('90'));
  expect(card('Minimum (Min)')).toContain('20');
  expect(card('Mean Average (Avg)')).toContain('50');
  expect(card('95th Percentile (P95)')).toContain('90');
  expect(screen.getByText(/3 points in view/)).toBeTruthy();

  // Unticking a metric removes its series
  fireEvent.click(screen.getByLabelText(/CPU Ready Time \(ms\)/));
  await waitFor(() => expect(container.querySelector('path[data-series="cpu|ready_summation"]')).toBeNull());
  expect(container.querySelector('path[data-series="cpu|usage_average"]')).not.toBeNull();
});

test('Object detail page: properties, latest values, alerts, pinning and console link use real records', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  const { container } = render(<ObjectDetailPage resourceUuid="uuid-vm-1" {...pageProps} />);

  await waitFor(() => expect(screen.getByText('OBJECT DETAIL: VirtualMachine - sql-prod-01')).toBeTruthy());
  expect(container.textContent).toContain('Lab East');
  expect(container.textContent).toContain('VMWARE');

  await waitFor(() => expect(screen.getAllByTestId('latest-metric')[0].textContent).toContain('CPU Ready Time (ms)'));
  expect(screen.getAllByTestId('latest-metric')).toHaveLength(2);
  const latest = screen.getAllByTestId('latest-metric').map(r => r.textContent);
  expect(latest[0]).toContain('CPU Ready Time (ms)');
  expect(latest[0]).toContain('1250');
  expect(latest[1]).toContain('CPU Usage (%)');
  expect(latest[1]).toContain('90');

  // Properties and parent hierarchy collected from the source inventory
  expect(screen.getAllByTestId('object-property').map(p => p.textContent)).toEqual([
    'IP Address: 10.20.30.45',
    'Guest OS: Red Hat Enterprise Linux 9 (64-bit)'
  ]);
  expect(screen.getAllByTestId('hierarchy-level').map(h => h.textContent)).toEqual([
    'vCenter: vc-01.lab.local',
    'Datacenter: DC-East',
    'ESXi Host: esx-01.lab.local',
    'Datastore: vsan-ds-01'
  ]);
  // Tracked ancestors are links; untracked ones (vCenter, datacenter) are plain text.
  expect(within(screen.getAllByTestId('hierarchy-level')[0]).queryByRole('link')).toBeNull();
  fireEvent.click(within(screen.getAllByTestId('hierarchy-level')[2]).getByRole('link'));
  expect(navigations).toEqual(['/objects/uuid-host-1']);

  await waitFor(() => expect(screen.getAllByTestId('object-alert')).toHaveLength(1));
  expect(screen.getByTestId('object-alert').textContent).toContain('VM CPU contention is high');
  expect(screen.getByText('Active Alerts on this Resource (1 Active)')).toBeTruthy();

  await waitFor(() => expect(container.querySelector('path[data-series="cpu|usage_average"]')).not.toBeNull());

  // Pin -> persisted -> shows up in the Home pinned list
  fireEvent.click(screen.getByText('📌 Pin to Home'));
  await waitFor(() => expect(screen.getByText('📌 Unpin from Home')).toBeTruthy());
  expect((await app.get('/users/preferences')).body.pinnedObjects).toEqual([{ instanceId: 'lab-east', resourceUuid: 'uuid-vm-1' }]);

  cleanup();
  render(<HomePage {...pageProps} />);
  await waitFor(() => expect(within(screen.getByTestId('widget-PINNED_OBJECTS')).getByText('sql-prod-01')).toBeTruthy());
  expect(screen.getByTestId('widget-PINNED_OBJECTS').textContent).toContain('90%');
  cleanup();

  // Console deep link is requested from the backend and opened in a new tab
  render(<ObjectDetailPage resourceUuid="uuid-vm-1" {...pageProps} />);
  fireEvent.click(await waitFor(() => screen.getByText(/Open Object in VCF Operations Console/)));
  await waitFor(() => expect(open).toHaveBeenCalledWith(`${stub.url}/ui/index.action#/object/uuid-vm-1/summary`, '_blank', 'noopener,noreferrer'));
  open.mockRestore();

  // A changed guest IP at the source shows up after the next cycle.
  stub.properties['uuid-vm-1']['summary|guest|ipAddress'] = '10.20.30.99';
  await scheduler.executePollingCycle();
  cleanup();
  render(<ObjectDetailPage resourceUuid="uuid-vm-1" {...pageProps} />);
  await waitFor(() => expect(screen.getAllByTestId('object-property')[0].textContent).toBe('IP Address: 10.20.30.99'));

  cleanup();
  render(<ObjectDetailPage resourceUuid="missing-uuid" {...pageProps} />);
  await waitFor(() => expect(screen.getByText(/Resource missing-uuid not found/)).toBeTruthy());
});

test('Alert detail page: shows the stored alert, its resource and a chart marked at the trigger time', async () => {
  const { container } = render(<AlertDetailPage alertId="alert-cpu" {...pageProps} />);

  await waitFor(() => expect(screen.getByText('ALERT DETAILS: VM CPU contention is high')).toBeTruthy());
  expect(container.textContent).toContain('alert-cpu');
  expect(container.textContent).toContain('CRITICAL');
  expect(container.textContent).toContain('ACTIVE');
  expect(container.textContent).toContain(new Date(t0 - 45_000).toISOString().replace('T', ' ').substring(0, 19));
  expect(screen.getByText('sql-prod-01')).toBeTruthy();

  // Triggering condition from the alert's contributing symptom
  expect(screen.getByTestId('alert-condition').textContent).toBe('Triggering Stat Key: cpu|readyPct > 10 CRITICAL');

  // The triggering metric is not collected on schedule; its chart is read live from the source.
  const triggering = screen.getByTestId('triggering-metric');
  await waitFor(() => expect(triggering.querySelectorAll('circle[data-point="cpu|readyPct"]')).toHaveLength(2));
  expect(triggering.textContent).toContain('2 time points read live from the source instance');
  expect(within(triggering).getByTestId('chart-marker').textContent).toBe('Alert triggered');
  expect(getDatabase().prepare("SELECT count(*) as count FROM raw_metrics WHERE stat_key = 'cpu|readyPct'").get().count).toBe(0);
  const liveRequest = stub.requestsTo('/suite-api/api/resources/stats/query').find(r => r.body.statKey.length === 1 && r.body.statKey[0] === 'cpu|readyPct');
  expect(liveRequest!.body.resourceId).toEqual(['uuid-vm-1']);

  await waitFor(() => expect(container.querySelectorAll('circle[data-point="cpu|usage_average"]')).toHaveLength(3));
  expect(screen.getAllByTestId('chart-marker')).toHaveLength(2);

  fireEvent.click(screen.getByText('sql-prod-01'));
  expect(navigations).toEqual(['/objects/uuid-vm-1']);

  cleanup();
  render(<AlertDetailPage alertId="no-such-alert" {...pageProps} />);
  await waitFor(() => expect(screen.getByText(/Alert no-such-alert not found/)).toBeTruthy());
});

test('Settings page: instances table, real connection test, add/delete instance and telemetry rule toggle', async () => {
  render(<SettingsPage user={{ username: 'admin', role: 'ADMIN' }} />);

  await waitFor(() => expect(screen.getAllByTestId('instance-row')).toHaveLength(1));
  expect(screen.getByTestId('instance-row').textContent).toContain('Lab East');
  expect(screen.getByTestId('instance-row').textContent).toContain('HEALTHY');
  await waitFor(() => expect(screen.getByTestId('ingestion-banner').textContent).toContain('1 of 1 instances healthy'));
  expect(screen.getByTestId('ingestion-banner').textContent).toContain('4 objects tracked');

  // Retention form: starts from the values in force, rejects out-of-range input, saves real settings
  const rawInput = screen.getByLabelText('Raw Metrics Buffer Retention (Hours)') as HTMLInputElement;
  const summaryInput = screen.getByLabelText('Summary Rollup Retention (Days)') as HTMLInputElement;
  await waitFor(() => expect(rawInput.value).toBe('48'));
  expect(summaryInput.value).toBe('90');

  fireEvent.change(rawInput, { target: { value: '5' } });
  fireEvent.click(screen.getByText('💾 Save Retention Policies'));
  await waitFor(() => expect(screen.getByTestId('retention-status').textContent).toContain('rawHours must be a whole number between 12 and 168.'));
  expect((await app.get('/system/status')).body.retention).toEqual({ rawHours: 48, summaryDays: 90 });

  fireEvent.change(rawInput, { target: { value: '24' } });
  fireEvent.change(summaryInput, { target: { value: '60' } });
  fireEvent.click(screen.getByText('💾 Save Retention Policies'));
  await waitFor(() => expect(screen.getByTestId('retention-status').textContent).toContain('Retention saved: raw samples 24 hours, summary rollups 60 days'));
  await waitFor(() => expect(screen.getByTestId('retention-raw-current').textContent).toBe('24 hours'));
  expect(screen.getByTestId('retention-summary-current').textContent).toBe('60 days');
  expect((await app.get('/system/status')).body.retention).toEqual({ rawHours: 24, summaryDays: 60 });
  const storedRetention = getDatabase().prepare("SELECT value FROM system_settings WHERE key = 'retention_raw_hours'").get();
  expect(storedRetention.value).toBe('24');

  // Add an instance: failed test, successful test, then save
  fireEvent.click(screen.getByText('+ Add VCF Instance Connection'));
  fireEvent.change(screen.getByLabelText('Instance Name'), { target: { value: 'Lab West' } });
  fireEvent.change(screen.getByLabelText('Hostname / IP Address'), { target: { value: stub.url } });
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: stub.username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
  fireEvent.click(screen.getByText('🧪 Test Connection'));
  await waitFor(() => expect(screen.getByTestId('test-status').textContent).toContain('HTTP 401'));

  fireEvent.change(screen.getByLabelText('Password'), { target: { value: stub.password } });
  fireEvent.click(screen.getByText('🧪 Test Connection'));
  await waitFor(() => expect(screen.getByTestId('test-status').textContent).toContain('VCF Operations 9.1.0'));

  fireEvent.click(screen.getByText('💾 Save Instance'));
  await waitFor(() => expect(screen.getAllByTestId('instance-row')).toHaveLength(2));
  const westRow = screen.getAllByTestId('instance-row').find(r => r.textContent!.includes('Lab West'))!;
  expect(westRow.textContent).toContain('PENDING');
  expect(getDatabase().prepare("SELECT hostname FROM vcf_instances WHERE id = 'lab-west'").get().hostname).toBe(stub.url);

  // Telemetry grid lists the YAML rules for the selected kind; toggling and saving rewrites the YAML
  await waitFor(() => expect(screen.getByText('cpu|usagemhz_average')).toBeTruthy());
  fireEvent.click(screen.getByText('HostSystem'));
  expect(screen.getByText('mem|swapused_average')).toBeTruthy();
  expect(screen.queryByText('cpu|usagemhz_average')).toBeNull();
  const swapRow = screen.getByText('mem|swapused_average').closest('tr')!;
  expect(within(swapRow).getByText('ACTIVE')).toBeTruthy();
  fireEvent.click(within(swapRow).getByText('Disable'));
  expect(within(screen.getByText('mem|swapused_average').closest('tr')!).getByText('DISABLED')).toBeTruthy();

  fireEvent.click(screen.getByText('💾 Save & Apply Dynamic Telemetry Rules'));
  await waitFor(() => expect(screen.getByText(/Metrics collection configuration saved/)).toBeTruthy());
  const savedConfig = (await app.get('/system/config/metrics')).body.config;
  expect(savedConfig.object_types.HostSystem.metrics.find((m: any) => m.key === 'mem|swapused_average').active).toBe(false);
  expect(savedConfig.object_types.HostSystem.metrics.find((m: any) => m.key === 'mem|usage_average').active).toBe(true);

  // Delete removes the row and the record
  fireEvent.click(within(screen.getAllByTestId('instance-row').find(r => r.textContent!.includes('Lab West'))!).getByText('Delete'));
  await waitFor(() => expect(screen.getAllByTestId('instance-row')).toHaveLength(1));
  expect(getDatabase().prepare("SELECT count(*) as count FROM vcf_instances WHERE id = 'lab-west'").get().count).toBe(0);
});

test('App shell: instance scope lists registered instances and scoping filters the pages', async () => {
  await app.post('/instances', { name: 'Empty Site', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: 'unused' });
  window.history.pushState({}, '', '/alerts');
  render(<App />);

  const scope = await waitFor(() => screen.getByLabelText('Instance Scope:')) as HTMLSelectElement;
  expect(screen.getByTestId('session-user').textContent).toContain('admin (ADMIN)');
  await waitFor(() => expect(Array.from(scope.options).map(o => o.textContent)).toEqual(['All VCF Instances (2)', 'Empty Site', 'Lab East']));
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));

  fireEvent.change(scope, { target: { value: 'empty-site' } });
  await waitFor(() => expect(screen.getByText('No alerts match the current filters.')).toBeTruthy());
  expect(screen.queryAllByTestId('alert-row')).toHaveLength(0);

  fireEvent.change(scope, { target: { value: 'lab-east' } });
  await waitFor(() => expect(screen.getAllByTestId('alert-row')).toHaveLength(3));

  // Client-side routing
  fireEvent.click(screen.getByText('Settings'));
  await waitFor(() => expect(screen.getByText('System & VCF Instance Configuration')).toBeTruthy());
  expect(window.location.pathname).toBe('/settings');

  await app.del('/instances/empty-site');
});

test('Sign-in flow: no session shows the login page, bad credentials are refused, sign-out ends the session', async () => {
  setAuthToken(null);
  window.history.pushState({}, '', '/alerts');
  render(<App />);

  // Without a session no data is requested or shown, only the sign-in form.
  await waitFor(() => expect(screen.getByText('Sign in to your central portal')).toBeTruthy());
  expect(screen.queryByText('Alerts Analysis Workspace')).toBeNull();
  expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');

  fireEvent.change(screen.getByLabelText('Username'), { target: { value: TEST_ADMIN.username } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-the-password' } });
  fireEvent.click(screen.getByText('Sign In'));
  await waitFor(() => expect(screen.getByTestId('login-error').textContent).toContain('Invalid username or password.'));
  expect(screen.queryByText('Alerts Analysis Workspace')).toBeNull();

  fireEvent.change(screen.getByLabelText('Password'), { target: { value: TEST_ADMIN.password } });
  fireEvent.click(screen.getByText('Sign In'));
  await waitFor(() => expect(screen.getByText('Alerts Analysis Workspace')).toBeTruthy());
  await waitFor(() => expect(screen.getAllByTestId('alert-row').length).toBeGreaterThan(0));
  expect(screen.getByTestId('session-user').textContent).toContain('admin (ADMIN)');

  fireEvent.click(screen.getByText('Sign Out'));
  await waitFor(() => expect(screen.getByText('Sign in to your central portal')).toBeTruthy());
  expect(screen.queryByTestId('alert-row')).toBeNull();

  setAuthToken(app.token);
});

test('Accounts: an administrator creates a viewer; the viewer sees data but is refused changes; a revoked session returns to sign-in', async () => {
  render(<SettingsPage user={{ username: 'admin', role: 'ADMIN' }} />);

  await waitFor(() => expect(screen.getAllByTestId('user-row')).toHaveLength(1));
  expect(screen.getByTestId('user-row').textContent).toContain('admin');

  fireEvent.change(screen.getByLabelText('New Username'), { target: { value: 'noc-viewer' } });
  fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'short' } });
  fireEvent.click(screen.getByText('+ Add User'));
  await waitFor(() => expect(screen.getByTestId('account-message').textContent).toContain('Password must be at least 8 characters.'));

  fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'Viewer-Pw-12345' } });
  fireEvent.click(screen.getByText('+ Add User'));
  await waitFor(() => expect(screen.getAllByTestId('user-row')).toHaveLength(2));
  expect(screen.getAllByTestId('user-row')[1].textContent).toContain('noc-viewer');
  expect(screen.getAllByTestId('user-row')[1].textContent).toContain('VIEWER');
  const storedHash = getDatabase().prepare("SELECT password_hash FROM users WHERE username = 'noc-viewer'").get().password_hash;
  expect(storedHash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  cleanup();

  // Sign in as the viewer through the real app
  setAuthToken(null);
  window.history.pushState({}, '', '/settings');
  render(<App />);
  await waitFor(() => expect(screen.getByText('Sign in to your central portal')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'noc-viewer' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Viewer-Pw-12345' } });
  fireEvent.click(screen.getByText('Sign In'));

  await waitFor(() => expect(screen.getByTestId('session-user').textContent).toContain('noc-viewer (VIEWER)'));
  await waitFor(() => expect(screen.getAllByTestId('instance-row')).toHaveLength(1));
  expect(screen.getByTestId('viewer-notice')).toBeTruthy();
  expect(screen.queryByTestId('user-row')).toBeNull();

  // The server, not just the UI, refuses a viewer's change.
  fireEvent.click(within(screen.getByTestId('instance-row')).getByText('Delete'));
  await waitFor(() => expect(screen.getByText(/Could not delete Lab East: Administrator role required\./)).toBeTruthy());
  expect(getDatabase().prepare("SELECT count(*) as count FROM vcf_instances WHERE id = 'lab-east'").get().count).toBe(1);

  // The administrator deletes the account: the viewer's next request is rejected and the app returns to sign-in.
  expect((await app.del('/auth/users/noc-viewer')).status).toBe(200);
  fireEvent.click(screen.getByText('Alerts'));
  await waitFor(() => expect(screen.getByText('Sign in to your central portal')).toBeTruthy());

  setAuthToken(app.token);
});
