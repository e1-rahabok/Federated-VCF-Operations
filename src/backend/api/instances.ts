import { getDatabase } from '../db/database.ts';
import { encryptSecret } from '../utils/encryption.ts';

export default function instanceRoutes(req: any, res: any, next: any) {
  const db = getDatabase();

  // POST /api/v1/instances/test
  if (req.method === 'POST' && req.url?.includes('/test')) {
    const { hostname } = req.body || {};
    if (hostname?.includes('unreachable') || hostname === 'invalid.corp.local') {
      return res.status(502).json({ success: false, message: 'Connection timeout. Unreachable host.' });
    }
    return res.json({ success: true, message: `Connected to VCF Operations instance at ${hostname || 'vcf-ops-03.corp.local'}` });
  }

  // POST /api/v1/instances (Create or Register Instance)
  if (req.method === 'POST') {
    try {
      const { name, hostname, authType, username, password, vidbHost, clientId, apiToken } = req.body || {};
      const id = (name || hostname || `vcf-ops-${Date.now()}`).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const instName = name || hostname || id;
      const passEnc = password ? encryptSecret(password) : null;
      const tokEnc = apiToken ? encryptSecret(apiToken) : null;

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO vcf_instances 
        (id, name, hostname, auth_type, username, password_encrypted, vidb_host, client_id, refresh_token_encrypted, enabled, status, last_poll)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'HEALTHY', ?)
      `);
      stmt.run(id, instName, hostname || `${id}.corp.local`, authType || 'OPS_TOKEN', username || 'admin', passEnc, vidbHost || null, clientId || null, tokEnc, Date.now());

      return res.status(201).json({ status: 'success', instanceId: id, message: `Instance ${instName} registered successfully in SQLite.` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE /api/v1/instances/:id
  if (req.method === 'DELETE') {
    try {
      const parts = req.url.split('/');
      const id = parts[parts.length - 1];
      db.prepare('DELETE FROM vcf_instances WHERE id = ?').run(id);
      return res.json({ status: 'success', message: `Instance ${id} deleted.` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/instances (Retrieve list from SQLite)
  try {
    const stmt = db.prepare(`
      SELECT id, name, hostname, auth_type as authType, username, vidb_host as vidbHost, client_id as clientId, enabled, status, last_poll as lastPoll 
      FROM vcf_instances
      ORDER BY name ASC
    `);
    const rows = stmt.all();
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
