import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { PollingScheduler } from '../../src/backend/ingestion/scheduler.ts';
import { VcfOpsStub } from '../helpers/vcfOpsStub.ts';
import { startTestApp } from '../helpers/testApp.ts';

/**
 * Outage and recovery of one instance. The instance is registered with a password the stub
 * rejects (a failing source); "recovery" is the stub starting to accept that password.
 * Polling attempts are observed as token requests arriving at the stub.
 */

const stub = new VcfOpsStub();
let app: Awaited<ReturnType<typeof startTestApp>>;

const COOLDOWN_SECONDS = 0.4;
const INSTANCE_PASSWORD = 'instance-password';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const attempts = () => stub.requestsTo('/suite-api/api/auth/token/acquire').length;
const instance = async (id: string) => (await app.get('/instances')).body.find((i: any) => i.id === id);

beforeAll(async () => {
  await stub.start();
  app = await startTestApp();
  stub.resources = [{ identifier: 'uuid-vm-1', name: 'sql-prod-01', resourceKind: 'VirtualMachine' }];
});

beforeEach(async () => {
  stub.requests = [];
  stub.password = 'source-is-down';
  for (const existing of (await app.get('/instances')).body) {
    await app.del(`/instances/${existing.id}`);
  }
});

afterAll(async () => {
  await app.stop();
  await stub.stop();
});

test('After three failed polls the breaker opens, retries after the cooldown with doubling waits, and closes on recovery', async () => {
  await app.post('/instances', { name: 'Flaky Site', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: INSTANCE_PASSWORD });
  const scheduler = new PollingScheduler(60, { circuitBreakerCooldownSeconds: COOLDOWN_SECONDS, circuitBreakerMaxCooldownSeconds: 60 });

  // Three consecutive failures: each cycle really attempts the instance.
  for (let cycle = 1; cycle <= 3; cycle++) {
    await scheduler.executePollingCycle();
    expect(attempts()).toBe(cycle);
  }
  let state = await instance('flaky-site');
  expect(state.status).toBe('ERROR');
  expect(state.lastError).toContain('HTTP 401');
  expect(state.lastError).toContain('polling paused after 3 consecutive failures');

  // Breaker open: cycles inside the cooldown do not touch the instance.
  await scheduler.executePollingCycle();
  await scheduler.executePollingCycle();
  expect(attempts()).toBe(3);

  // Cooldown over, source still down: exactly one trial poll, then the wait doubles.
  await wait(COOLDOWN_SECONDS * 1000 + 100);
  await scheduler.executePollingCycle();
  expect(attempts()).toBe(4);
  await scheduler.executePollingCycle();
  expect(attempts()).toBe(4);
  expect((await instance('flaky-site')).lastError).toContain('polling paused after 4 consecutive failures');

  // One original cooldown later the doubled wait has not elapsed yet.
  await wait(COOLDOWN_SECONDS * 1000 + 100);
  await scheduler.executePollingCycle();
  expect(attempts()).toBe(4);

  // The source recovers. Once the doubled wait has passed, the trial poll succeeds and data flows again.
  stub.password = INSTANCE_PASSWORD;
  await wait(COOLDOWN_SECONDS * 1000);
  await scheduler.executePollingCycle();
  expect(attempts()).toBe(5);

  state = await instance('flaky-site');
  expect(state).toMatchObject({ status: 'HEALTHY', lastError: null });
  expect((await app.get('/objects/summary')).body).toEqual({ total: 1, byKind: { VirtualMachine: 1 } });

  // Breaker closed: polling is back to every cycle, with the token reused.
  stub.requests = [];
  await scheduler.executePollingCycle();
  expect(stub.requestsTo('/suite-api/api/resources')).toHaveLength(1);
  expect(attempts()).toBe(0);

  // After recovery a new outage needs three fresh failures before the breaker opens again.
  stub.revokeAllTokens();
  stub.password = 'source-is-down';
  await scheduler.executePollingCycle();
  await scheduler.executePollingCycle();
  expect((await instance('flaky-site')).lastError).not.toContain('polling paused');
  await scheduler.executePollingCycle();
  expect((await instance('flaky-site')).lastError).toContain('polling paused after 3 consecutive failures');
});

test('Correcting the instance settings resets an open breaker so the next cycle polls immediately', async () => {
  await app.post('/instances', { name: 'Typo Site', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: 'mistyped-password' });
  // A long cooldown: without the reset the instance would stay paused for the rest of the test.
  const scheduler = new PollingScheduler(60, { circuitBreakerCooldownSeconds: 3600 });
  stub.password = INSTANCE_PASSWORD;

  for (let cycle = 0; cycle < 3; cycle++) await scheduler.executePollingCycle();
  await scheduler.executePollingCycle();
  expect(attempts()).toBe(3);
  expect((await instance('typo-site')).status).toBe('ERROR');

  // The administrator re-saves the instance with the right password.
  await app.post('/instances', { name: 'Typo Site', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: INSTANCE_PASSWORD });
  await scheduler.executePollingCycle();

  expect(attempts()).toBe(4);
  expect(await instance('typo-site')).toMatchObject({ status: 'HEALTHY', lastError: null });
});

test('An open breaker on one instance does not pause a healthy instance', async () => {
  const healthyStub = new VcfOpsStub();
  await healthyStub.start();
  healthyStub.resources = [{ identifier: 'uuid-host-9', name: 'esx-09.lab.local', resourceKind: 'HostSystem' }];

  try {
    await app.post('/instances', { name: 'Down Site', hostname: stub.url, authType: 'OPS_TOKEN', username: stub.username, password: INSTANCE_PASSWORD });
    await app.post('/instances', { name: 'Up Site', hostname: healthyStub.url, authType: 'OPS_TOKEN', username: healthyStub.username, password: healthyStub.password });
    const scheduler = new PollingScheduler(60, { circuitBreakerCooldownSeconds: 3600 });

    for (let cycle = 0; cycle < 5; cycle++) await scheduler.executePollingCycle();

    expect(attempts()).toBe(3);
    expect(healthyStub.requestsTo('/suite-api/api/resources')).toHaveLength(5);
    expect((await instance('down-site')).status).toBe('ERROR');
    expect((await instance('up-site')).status).toBe('HEALTHY');
  } finally {
    await healthyStub.stop();
  }
});
