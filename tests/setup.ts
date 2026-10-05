import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Runs in every test worker before the application modules load, so each test file gets
// its own SQLite database and its own copy of the YAML collection rules. Nothing a test
// writes can reach the developer's database or the repository's Configuration folder.
const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'federated-vcf-ops-config-'));
for (const file of ['metrics_list.yaml', 'alerts_list.yaml']) {
  fs.copyFileSync(path.join(process.cwd(), 'Configuration', file), path.join(configDir, file));
}

process.env.CONFIG_DIR = configDir;
process.env.DATABASE_URL = ':memory:';
process.env.ALLOW_INSECURE_HTTP = 'true';
process.env.SEED_DEMO_DATA = 'false';
process.env.API_TIMEOUT_SECONDS = '5';
