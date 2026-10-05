import express from 'express';
import { getDatabase } from '../db/database.ts';
import { encryptSecret } from '../utils/encryption.ts';
import { VcfOpsApiClient, resolveBaseUrl, type VcfInstanceConfig } from '../ingestion/client.ts';

const router = express.Router();

// Console deep-link paths. These follow the Operations UI hash routes; adjust here if a
// VCF Operations release changes them.
const OBJECT_CONSOLE_PATH = (resourceUuid: string) => `/ui/index.action#/object/${encodeURIComponent(resourceUuid)}/summary`;
const ALERT_CONSOLE_PATH = (resourceUuid: string, alertId: string) =>
  `/ui/index.action#/object/${encodeURIComponent(resourceUuid)}/alertsAndSymptoms/alerts/${encodeURIComponent(alertId)}`;

function instanceConfigFromBody(body: any): VcfInstanceConfig {
  return {
    id: 'connection-test',
    name: body.name || body.hostname,
    hostname: body.hostname,
    authType: body.authType === 'BEARER_TOKEN' ? 'BEARER_TOKEN' : 'OPS_TOKEN',
    username: body.username,
    passwordEncrypted: body.password ? encryptSecret(body.password) : undefined,
    authSource: body.authSource || 'LOCAL',
    vidbHost: body.vidbHost,
    clientId: body.clientId,
    refreshTokenEncrypted: body.apiToken ? encryptSecret(body.apiToken) : undefined,
    verifyTls: body.verifyTls !== false
  };
}

// POST /api/v1/instances/test - authenticates against the target and reads its version
router.post('/test', async (req, res) => {
  const body = req.body || {};
  if (!body.hostname) {
    return res.status(400).json({ success: false, message: 'Hostname is required.' });
  }

  try {
    const client = new VcfOpsApiClient(instanceConfigFromBody(body));
    const { releaseName } = await client.testConnection();
    return res.json({ success: true, message: `Connected to ${body.hostname} (${releaseName}).`, releaseName });
  } catch (err: any) {
    return res.status(502).json({ success: false, message: err.message || 'Connection failed.' });
  }
});

// POST /api/v1/instances (Create or Register Instance)
router.post('/', (req, res) => {
  try {
    const { name, hostname, authType, username, password, authSource, vidbHost, clientId, apiToken, verifyTls } = req.body || {};
    if (!hostname) {
      return res.status(400).json({ error: 'Hostname is required.' });
    }
    resolveBaseUrl(hostname);

    const id = (name || hostname).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const instName = name || hostname;
    const passEnc = password ? encryptSecret(password) : null;
    const tokEnc = apiToken ? encryptSecret(apiToken) : null;

    getDatabase().prepare(`
      INSERT OR REPLACE INTO vcf_instances
      (id, name, hostname, auth_type, username, password_encrypted, auth_source, vidb_host, client_id, refresh_token_encrypted, verify_tls, enabled, status, last_poll)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'PENDING', NULL)
    `).run(id, instName, hostname, authType === 'BEARER_TOKEN' ? 'BEARER_TOKEN' : 'OPS_TOKEN', username || null, passEnc, authSource || 'LOCAL', vidbHost || null, clientId || null, tokEnc, verifyTls === false ? 0 : 1);

    return res.status(201).json({ status: 'success', instanceId: id, message: `Instance ${instName} registered successfully in SQLite.` });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// DELETE /api/v1/instances/:id - removes the instance and everything ingested from it
router.delete('/:id', (req, res) => {
  const db = getDatabase();
  const id = req.params.id;
  try {
    db.exec('BEGIN');
    for (const table of ['raw_metrics', 'summary_metrics', 'alerts', 'alert_conditions', 'resources', 'resource_properties', 'resource_relations', 'watermarks']) {
      db.prepare(`DELETE FROM ${table} WHERE instance_id = ?`).run(id);
    }
    const result = db.prepare('DELETE FROM vcf_instances WHERE id = ?').run(id);
    db.exec('COMMIT');

    if (!result.changes) {
      return res.status(404).json({ error: `Instance ${id} not found.` });
    }
    return res.json({ status: 'success', message: `Instance ${id} deleted.` });
  } catch (err: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/instances/:id/console-url?objectUuid=...&alertId=...
router.get('/:id/console-url', (req, res) => {
  try {
    const instance = getDatabase().prepare('SELECT hostname FROM vcf_instances WHERE id = ?').get(req.params.id);
    if (!instance) {
      return res.status(404).json({ error: `Instance ${req.params.id} not found.` });
    }

    const objectUuid = req.query.objectUuid ? String(req.query.objectUuid) : '';
    const alertId = req.query.alertId ? String(req.query.alertId) : '';
    if (!objectUuid) {
      return res.status(400).json({ error: 'objectUuid is required.' });
    }

    const base = resolveBaseUrl(instance.hostname);
    const url = base + (alertId ? ALERT_CONSOLE_PATH(objectUuid, alertId) : OBJECT_CONSOLE_PATH(objectUuid));
    return res.json({ url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/instances (Retrieve list from SQLite)
router.get('/', (req, res) => {
  try {
    const rows = getDatabase().prepare(`
      SELECT id, name, hostname, auth_type as authType, username, auth_source as authSource, vidb_host as vidbHost,
             client_id as clientId, verify_tls as verifyTls, enabled, status, last_poll as lastPoll, last_error as lastError
      FROM vcf_instances
      ORDER BY name ASC
    `).all();
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
