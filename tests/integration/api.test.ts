import { test } from 'node:test';
import assert from 'node:assert';

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

test('REST API Gateway Integration Tests - alerts endpoint', async () => {
  const res = await fetch('http://localhost:3000/api/v1/alerts');
  assert.strictEqual(res.status, 200);
  const alerts = await res.json();
  assert.ok(Array.isArray(alerts));
  assert.ok(alerts.length > 0);
});

test('REST API Gateway Integration Tests - metrics query endpoint', async () => {
  const res = await fetch('http://localhost:3000/api/v1/metrics/query');
  assert.strictEqual(res.status, 200);
  const metrics = await res.json();
  assert.ok(Array.isArray(metrics));
  assert.ok(metrics.length > 0);
});
