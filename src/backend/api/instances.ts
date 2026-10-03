import { getDatabase } from '../db/database.ts';
import { encryptSecret } from '../utils/encryption.ts';

export default function instanceRoutes(req: any, res: any, next: any) {
  if (req.method === 'POST') {
    const { hostname } = req.body || {};
    if (req.url?.includes('/test')) {
      if (hostname?.includes('unreachable')) {
        return res.status(502).json({ success: false, message: 'Connection timeout. Unreachable host.' });
      }
      return res.json({ success: true, message: `Connected to VCF Operations instance at ${hostname || 'vcf-ops-03.corp.local'}` });
    }

    return res.json({ status: 'success', instanceId: req.body.id || 'vcf-ops-03' });
  }

  return res.json([
    { id: 'vcf-ops-01', name: 'VCF-Ops-01', hostname: 'vcf-ops-01.corp.local', authType: 'OPS_TOKEN', username: 'admin', enabled: true, status: 'HEALTHY', lastPoll: Date.now() - 10000 },
    { id: 'vcf-ops-02', name: 'VCF-Ops-02', hostname: 'vcf-ops-02.corp.local', authType: 'BEARER_TOKEN', vidbHost: 'vidb.corp.local', clientId: 'fed-client', enabled: true, status: 'HEALTHY', lastPoll: Date.now() - 15000 }
  ]);
}
