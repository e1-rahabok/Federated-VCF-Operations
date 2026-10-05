import { getDatabase } from '../db/database.ts';
import { VcfOpsApiClient, type VcfInstanceConfig } from './client.ts';

const INSTANCE_COLUMNS = `
  id, name, hostname, auth_type as authType, username, password_encrypted as passwordEncrypted,
  auth_source as authSource, vidb_host as vidbHost, client_id as clientId,
  refresh_token_encrypted as refreshTokenEncrypted, verify_tls as verifyTls
`;

// One client per instance, shared by the scheduler and on-demand API calls, so the
// instance's token is reused instead of re-acquired for every request.
const clients: Map<string, { fingerprint: string; client: VcfOpsApiClient }> = new Map();

export function listEnabledInstances(): VcfInstanceConfig[] {
  return getDatabase().prepare(`SELECT ${INSTANCE_COLUMNS} FROM vcf_instances WHERE enabled = 1`).all() || [];
}

export function findInstance(instanceId: string): VcfInstanceConfig | undefined {
  return getDatabase().prepare(`SELECT ${INSTANCE_COLUMNS} FROM vcf_instances WHERE id = ?`).get(instanceId);
}

export function getClient(instance: VcfInstanceConfig): VcfOpsApiClient {
  const fingerprint = JSON.stringify(instance);
  const cached = clients.get(instance.id);
  if (cached && cached.fingerprint === fingerprint) return cached.client;

  const client = new VcfOpsApiClient(instance);
  clients.set(instance.id, { fingerprint, client });
  return client;
}
