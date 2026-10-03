import { test } from 'node:test';
import assert from 'node:assert';
import { WatermarkManager } from '../../src/backend/ingestion/watermark.ts';

test('Watermark Manager Unit Tests - fallback watermark', async () => {
  const wm = new WatermarkManager();
  const lastWatermark = await wm.getLastWatermark('non-existent-instance', 'METRICS');
  assert.ok(lastWatermark < Date.now());
});
