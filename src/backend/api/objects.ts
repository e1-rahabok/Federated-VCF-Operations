import { getDatabase } from '../db/database.ts';

export default function objectRoutes(req: any, res: any, next: any) {
  if (req.url?.includes('/pinned')) {
    return res.json([
      { uuid: 'cluster-01', name: 'Cluster-01 (vSAN)', kind: 'Cluster', cpuUsage: 78, memUsage: 82, status: 'HEALTHY' },
      { uuid: 'vm-007', name: 'VM-007 (SQL-Prod)', kind: 'VirtualMachine', cpuUsage: 94, latencyMs: 25, status: 'WARNING' }
    ]);
  }

  if (req.url?.includes('/tree')) {
    return res.json([
      {
        id: 'vcf-ops-01',
        name: 'VCF-Ops-01 (Datacenter East)',
        clusters: [
          {
            id: 'cluster-01',
            name: 'Cluster-vSAN-01',
            hosts: [
              { id: 'esx-01', name: 'esx-01.corp.local', vms: [{ id: 'vm-007', name: 'VM-007 (SQL-Prod)' }, { id: 'vm-008', name: 'VM-008 (Web-App)' }] }
            ]
          }
        ]
      }
    ]);
  }

  const resourceUuid = req.params?.resourceUuid || 'vm-007';
  return res.json({
    resourceUuid,
    resourceName: resourceUuid === 'vm-007' ? 'VM-007 (SQL-Database-Prod)' : resourceUuid,
    resourceKind: 'VirtualMachine',
    vcfInstance: 'VCF-Ops-01',
    ipAddress: '10.20.30.45',
    guestOs: 'RHEL 9 (64-bit)',
    hierarchy: {
      vCenter: 'vc-01.corp.local',
      cluster: 'Cluster-vSAN-01',
      host: 'esx-04.corp.local',
      datastore: 'vsanDatastore'
    }
  });
}
