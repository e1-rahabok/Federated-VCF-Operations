import { test } from 'node:test';
import assert from 'node:assert';
import { RollupAggregator } from '../../src/backend/ingestion/rollup.ts';

test('Rollup Aggregator Unit Tests - purge expired raw metrics', async () => {
  const aggregator = new RollupAggregator();
  const purged = await aggregator.purgeExpiredRawMetrics(48);
  assert.strictEqual(typeof purged, 'number');
});
