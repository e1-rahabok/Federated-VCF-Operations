import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { VcfOpsApiClient, VcfOpsApiError, resolveBaseUrl, type VcfInstanceConfig } from '../../src/backend/ingestion/client.ts';
import { encryptSecret } from '../../src/backend/utils/encryption.ts';
import { VcfOpsStub } from '../helpers/vcfOpsStub.ts';

const stub = new VcfOpsStub();

beforeAll(() => stub.start());
afterAll(() => stub.stop());

beforeEach(() => {
  stub.requests = [];
  stub.resources = [
    { identifier: 'uuid-vm-1', name: 'sql-prod-01', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-vm-2', name: 'web-app-01', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-vm-3', name: 'web-app-02', resourceKind: 'VirtualMachine' },
    { identifier: 'uuid-host-1', name: 'esx-01.lab.local', resourceKind: 'HostSystem' },
    { identifier: 'uuid-nsx-1', name: 'edge-01', resourceKind: 'VirtualMachine', adapterKind: 'NSXTAdapter' }
  ];
  stub.samples = [];
  stub.alerts = [];
  stub.properties = {};
  stub.relations = [];
  stub.alertConditions = {};
});

function opsTokenInstance(overrides: Partial<VcfInstanceConfig> = {}): VcfInstanceConfig {
  return {
    id: 'stub-ops',
    name: 'Stub Ops',
    hostname: stub.url,
    authType: 'OPS_TOKEN',
    username: stub.username,
    passwordEncrypted: encryptSecret(stub.password),
    authSource: 'LOCAL',
    ...overrides
  };
}

test('OpsToken auth: sends decrypted credentials, then authorizes calls with "OpsToken <token>"', async () => {
  const client = new VcfOpsApiClient(opsTokenInstance());
  const { releaseName } = await client.testConnection();
  expect(releaseName).toBe('VCF Operations 9.1.0');

  const acquire = stub.requestsTo('/suite-api/api/auth/token/acquire');
  expect(acquire).toHaveLength(1);
  expect(acquire[0].body).toEqual({ username: 'svc-federated', password: 'S3cret!', authSource: 'LOCAL' });

  const versionCall = stub.requestsTo('/suite-api/api/versions/current')[0];
  expect(versionCall.authorization).toMatch(/^OpsToken stub-token-\d+$/);
});

test('OpsToken auth: token is cached across calls and re-acquired once after a 401', async () => {
  const client = new VcfOpsApiClient(opsTokenInstance());
  const issuedBefore = stub.tokensIssued;

  await client.testConnection();
  await client.testConnection();
  expect(stub.tokensIssued - issuedBefore).toBe(1);

  stub.revokeAllTokens();
  await client.testConnection();
  expect(stub.tokensIssued - issuedBefore).toBe(2);
});

test('OpsToken auth: wrong password surfaces the HTTP 401 from VCF Operations', async () => {
  const client = new VcfOpsApiClient(opsTokenInstance({ passwordEncrypted: encryptSecret('wrong') }));
  await expect(client.testConnection()).rejects.toMatchObject({ name: 'VcfOpsApiError', status: 401 });
});

test('Bearer auth: exchanges the VCF SSO API token at the Identity Broker and sends "Bearer <token>"', async () => {
  const client = new VcfOpsApiClient({
    id: 'stub-sso',
    name: 'Stub SSO',
    hostname: stub.url,
    authType: 'BEARER_TOKEN',
    vidbHost: stub.url,
    clientId: 'CUSTOMER',
    refreshTokenEncrypted: encryptSecret(stub.apiToken)
  });
  await client.testConnection();

  const exchange = stub.requestsTo('/acs/t/CUSTOMER/token');
  expect(exchange).toHaveLength(1);
  expect(exchange[0].body).toEqual({
    grant_type: 'urn:custom:vcf:params:oauth:grant-type:api-token',
    api_token: 'vcf-sso-api-token'
  });
  expect(stub.requestsTo('/suite-api/api/versions/current')[0].authorization).toMatch(/^Bearer stub-token-\d+$/);
});

test('fetchObjects: follows pagination and filters by adapter and resource kind', async () => {
  const client = new VcfOpsApiClient(opsTokenInstance());
  const objects = await client.fetchObjects(['VirtualMachine', 'HostSystem']);

  // Stub serves 2 per page, so 4 matching resources need more than one request.
  expect(stub.requestsTo('/suite-api/api/resources').length).toBeGreaterThanOrEqual(2);
  expect(objects.map(o => o.uuid).sort()).toEqual(['uuid-host-1', 'uuid-vm-1', 'uuid-vm-2', 'uuid-vm-3']);
  expect(objects.find(o => o.uuid === 'uuid-host-1')).toEqual({
    uuid: 'uuid-host-1', name: 'esx-01.lab.local', kind: 'HostSystem', adapterKind: 'VMWARE'
  });

  const first = stub.requestsTo('/suite-api/api/resources')[0];
  expect(first.query.get('adapterKind')).toBe('VMWARE');
  expect(first.query.getAll('resourceKind')).toEqual(['VirtualMachine', 'HostSystem']);
});

test('fetchMetricsDelta: requests the begin/end window and flattens stat-list into samples', async () => {
  stub.samples = [
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: 1000, value: 11.5 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: 2000, value: 42.25 },
    { resourceId: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: 3000, value: 63 },
    { resourceId: 'uuid-vm-1', statKey: 'mem|usage_average', timestamp: 2000, value: 71 },
    { resourceId: 'uuid-vm-2', statKey: 'cpu|usage_average', timestamp: 2000, value: 5 },
    { resourceId: 'uuid-vm-2', statKey: 'net|usage_average', timestamp: 2000, value: 999 }
  ];

  const client = new VcfOpsApiClient(opsTokenInstance());
  const points = await client.fetchMetricsDelta(['uuid-vm-1', 'uuid-vm-2'], ['cpu|usage_average', 'mem|usage_average'], 1500, 2500);

  expect(stub.requestsTo('/suite-api/api/resources/stats/query')[0].body).toEqual({
    resourceId: ['uuid-vm-1', 'uuid-vm-2'],
    statKey: ['cpu|usage_average', 'mem|usage_average'],
    begin: 1500,
    end: 2500
  });
  expect(points.sort((a, b) => (a.resourceUuid + a.statKey).localeCompare(b.resourceUuid + b.statKey))).toEqual([
    { resourceUuid: 'uuid-vm-1', statKey: 'cpu|usage_average', timestamp: 2000, statValue: 42.25 },
    { resourceUuid: 'uuid-vm-1', statKey: 'mem|usage_average', timestamp: 2000, statValue: 71 },
    { resourceUuid: 'uuid-vm-2', statKey: 'cpu|usage_average', timestamp: 2000, statValue: 5 }
  ]);
});

test('fetchAlerts: pages through alert query results and normalizes fields', async () => {
  stub.alerts = [
    { alertId: 'a-1', resourceId: 'uuid-vm-1', alertLevel: 'CRITICAL', status: 'ACTIVE', alertDefinitionName: 'VM CPU contention', startTimeUTC: 100, updateTimeUTC: 150, cancelTimeUTC: 0 },
    { alertId: 'a-2', resourceId: 'uuid-vm-2', alertLevel: 'INFORMATION', status: 'ACTIVE', alertDefinitionName: 'Snapshot is old', startTimeUTC: 200, updateTimeUTC: 200, cancelTimeUTC: 0 },
    { alertId: 'a-3', resourceId: 'uuid-host-1', alertLevel: 'IMMEDIATE', status: 'ACTIVE', alertDefinitionName: 'Host memory contention', startTimeUTC: 300, updateTimeUTC: 300, cancelTimeUTC: 0 },
    { alertId: 'a-4', resourceId: 'uuid-host-1', alertLevel: 'WARNING', status: 'CANCELED', alertDefinitionName: 'Host NIC down', startTimeUTC: 50, updateTimeUTC: 400, cancelTimeUTC: 400 }
  ];

  const client = new VcfOpsApiClient(opsTokenInstance());
  const active = await client.fetchAlerts({ activeOnly: true });

  expect(stub.requestsTo('/suite-api/api/alerts/query').length).toBeGreaterThanOrEqual(2);
  expect(active.map(a => a.alertId).sort()).toEqual(['a-1', 'a-2', 'a-3']);
  expect(active.find(a => a.alertId === 'a-2')).toEqual({
    alertId: 'a-2', resourceUuid: 'uuid-vm-2', alertName: 'Snapshot is old', severity: 'INFO',
    status: 'ACTIVE', startTime: 200, updateTime: 200, cancelTime: null
  });

  const canceled = await client.fetchAlerts({ cancelTimeRange: { startTime: 350, endTime: 500 } });
  expect(canceled).toEqual([{
    alertId: 'a-4', resourceUuid: 'uuid-host-1', alertName: 'Host NIC down', severity: 'WARNING',
    status: 'CANCELED', startTime: 50, updateTime: 400, cancelTime: 400
  }]);
});

test('fetchProperties: sends the bulk property query and reads text and numeric values', async () => {
  stub.properties = {
    'uuid-vm-1': { 'summary|guest|ipAddress': '10.20.30.45', 'summary|guest|fullName': 'Red Hat Enterprise Linux 9 (64-bit)', 'config|hardware|numCpu': 8 },
    'uuid-vm-2': { 'summary|guest|ipAddress': '10.20.30.46', 'not|requested': 'x' }
  };

  const client = new VcfOpsApiClient(opsTokenInstance());
  const properties = await client.fetchProperties(['uuid-vm-1', 'uuid-vm-2'], ['summary|guest|ipAddress', 'summary|guest|fullName', 'config|hardware|numCpu']);

  expect(stub.requestsTo('/suite-api/api/resources/properties/latest/query')[0].body).toEqual({
    resourceIds: ['uuid-vm-1', 'uuid-vm-2'],
    propertyKeys: ['summary|guest|ipAddress', 'summary|guest|fullName', 'config|hardware|numCpu']
  });
  expect(properties).toEqual([
    { resourceUuid: 'uuid-vm-1', key: 'summary|guest|ipAddress', value: '10.20.30.45' },
    { resourceUuid: 'uuid-vm-1', key: 'summary|guest|fullName', value: 'Red Hat Enterprise Linux 9 (64-bit)' },
    { resourceUuid: 'uuid-vm-1', key: 'config|hardware|numCpu', value: '8' },
    { resourceUuid: 'uuid-vm-2', key: 'summary|guest|ipAddress', value: '10.20.30.46' }
  ]);
});

test('fetchRelated: returns ancestors and children of the requested kinds, across pages', async () => {
  stub.resources.push(
    { identifier: 'uuid-vc-1', name: 'vc-01.lab.local', resourceKind: 'VMwareAdapter Instance' },
    { identifier: 'uuid-dc-1', name: 'DC-East', resourceKind: 'Datacenter' },
    { identifier: 'uuid-cluster-1', name: 'Cluster-01', resourceKind: 'ClusterComputeResource' },
    { identifier: 'uuid-ds-1', name: 'vsan-ds-01', resourceKind: 'Datastore' }
  );
  stub.relations = [
    { parent: 'uuid-vc-1', child: 'uuid-dc-1' },
    { parent: 'uuid-dc-1', child: 'uuid-cluster-1' },
    { parent: 'uuid-cluster-1', child: 'uuid-host-1' },
    { parent: 'uuid-host-1', child: 'uuid-vm-1' },
    { parent: 'uuid-host-1', child: 'uuid-vm-2' },
    { parent: 'uuid-vm-1', child: 'uuid-ds-1' }
  ];

  const client = new VcfOpsApiClient(opsTokenInstance());
  const ancestors = await client.fetchRelated(['uuid-vm-1', 'uuid-vm-2'], 'ANCESTOR', ['VMwareAdapter Instance', 'Datacenter', 'ClusterComputeResource', 'HostSystem']);

  const requests = stub.requestsTo('/suite-api/api/resources/bulk/relationships');
  expect(requests.length).toBeGreaterThanOrEqual(2);
  expect(requests[0].body).toEqual({
    relationshipType: 'ANCESTOR',
    resourceIds: ['uuid-vm-1', 'uuid-vm-2'],
    resourceQuery: { resourceKind: ['VMwareAdapter Instance', 'Datacenter', 'ClusterComputeResource', 'HostSystem'] },
    hierarchyDepth: 6
  });
  const forVm1 = ancestors.filter(r => r.resourceUuid === 'uuid-vm-1').sort((a, b) => a.relatedKind.localeCompare(b.relatedKind));
  expect(forVm1).toEqual([
    { resourceUuid: 'uuid-vm-1', relatedUuid: 'uuid-cluster-1', relatedName: 'Cluster-01', relatedKind: 'ClusterComputeResource' },
    { resourceUuid: 'uuid-vm-1', relatedUuid: 'uuid-dc-1', relatedName: 'DC-East', relatedKind: 'Datacenter' },
    { resourceUuid: 'uuid-vm-1', relatedUuid: 'uuid-host-1', relatedName: 'esx-01.lab.local', relatedKind: 'HostSystem' },
    { resourceUuid: 'uuid-vm-1', relatedUuid: 'uuid-vc-1', relatedName: 'vc-01.lab.local', relatedKind: 'VMwareAdapter Instance' }
  ]);
  expect(ancestors.filter(r => r.resourceUuid === 'uuid-vm-2')).toHaveLength(4);

  const datastores = await client.fetchRelated(['uuid-vm-1', 'uuid-vm-2'], 'CHILD', ['Datastore']);
  expect(datastores).toEqual([
    { resourceUuid: 'uuid-vm-1', relatedUuid: 'uuid-ds-1', relatedName: 'vsan-ds-01', relatedKind: 'Datastore' }
  ]);
});

test('fetchAlertConditions: reads stat key, operator and threshold of each contributing symptom', async () => {
  stub.alertConditions = {
    'a-1': [
      { symptomId: 's-1', key: 'cpu|readyPct', operator: 'GT', value: '10', severity: 'CRITICAL' },
      { symptomId: 's-2', key: 'cpu|costopPct', operator: 'GT_EQ', value: '3', severity: 'INFORMATION' }
    ]
  };

  const client = new VcfOpsApiClient(opsTokenInstance());
  const conditions = await client.fetchAlertConditions(['a-1', 'a-without-symptoms']);

  const request = stub.requestsTo('/suite-api/api/alerts/contributingsymptoms')[0];
  expect(request.query.getAll('id')).toEqual(['a-1', 'a-without-symptoms']);
  expect(conditions).toEqual([
    { alertId: 'a-1', symptomId: 's-1', statKey: 'cpu|readyPct', operator: 'GT', threshold: '10', severity: 'CRITICAL' },
    { alertId: 'a-1', symptomId: 's-2', statKey: 'cpu|costopPct', operator: 'GT_EQ', threshold: '3', severity: 'INFO' }
  ]);
  expect(await client.fetchAlertConditions([])).toEqual([]);
});

test('resolveBaseUrl: bare hostnames become HTTPS', () => {
  expect(resolveBaseUrl('ops.lab.local')).toBe('https://ops.lab.local');
  expect(resolveBaseUrl('https://ops.lab.local/')).toBe('https://ops.lab.local');
  expect(() => resolveBaseUrl('')).toThrow(VcfOpsApiError);
});
