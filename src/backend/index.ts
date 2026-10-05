import { CONFIG } from './config.ts';
import { createApp } from './app.ts';
import { PollingScheduler } from './ingestion/scheduler.ts';

const app = createApp();

// Start Ingestion Scheduler
const scheduler = new PollingScheduler(CONFIG.POLLING_INTERVAL_SECONDS);
scheduler.start();

const server = app.listen(CONFIG.PORT, () => {
  console.log(`Federated VCF Operations app listening on port ${CONFIG.PORT}`);
});

server.on('error', (err: any) => {
  console.error('[Server] Failed to start:', err.message);
  scheduler.stop();
  process.exit(1);
});
