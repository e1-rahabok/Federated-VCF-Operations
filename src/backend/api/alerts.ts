import { getDatabase } from '../db/database.ts';

export default function alertRoutes(req: any, res: any, next: any) {
  const now = Date.now();

  if (req.url?.includes('/summary')) {
    return res.json({ critical: 3, immediate: 5, warning: 14, info: 8 });
  }

  if (req.url?.includes('/timeline')) {
    const buckets = [];
    for (let i = 12; i >= 0; i--) {
      buckets.push({
        timestamp: now - i * 60 * 60 * 1000,
        critical: Math.floor(Math.random() * 3),
        warning: Math.floor(Math.random() * 8) + 2,
        info: Math.floor(Math.random() * 5)
      });
    }
    return res.json(buckets);
  }

  if (req.params?.alertId) {
    return res.json({
      alertId: req.params.alertId,
      alertName: 'High CPU Ready Latency on Virtual Machine VM-007',
      severity: 'WARNING',
      status: 'ACTIVE',
      startTime: now - 18 * 60 * 1000,
      updateTime: now - 2 * 60 * 1000,
      resourceContext: {
        resourceUuid: 'vm-007',
        resourceName: 'VM-007 (SQL-Prod)',
        resourceKind: 'VirtualMachine',
        hostSystem: 'esx-04.corp.local',
        vcfInstance: 'VCF-Ops-01',
        vcfHostname: 'vcf-ops-01.corp.local'
      },
      triggeringStatKey: 'cpu|ready_summation'
    });
  }

  return res.json([
    { alertId: 'alt-98234-vcf', instanceId: 'VCF-Ops-01', resourceUuid: 'vm-007', resourceName: 'VM-007 (SQL-Prod)', alertName: 'High CPU Ready Latency on Virtual Machine VM-007', severity: 'WARNING', status: 'ACTIVE', startTime: now - 18 * 60 * 1000 },
    { alertId: 'alt-98235-vcf', instanceId: 'VCF-Ops-02', resourceUuid: 'esx-02', resourceName: 'esx-02.corp.local', alertName: 'Physical Power Supply Unit Fault', severity: 'CRITICAL', status: 'ACTIVE', startTime: now - 42 * 60 * 1000 }
  ]);
}
