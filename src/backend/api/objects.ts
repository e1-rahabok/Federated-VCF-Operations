import { getDatabase } from '../db/database.ts';

export default function objectRoutes(req: any, res: any, next: any) {
  const db = getDatabase();
  const url = req.url || '';

  // GET /api/v1/objects/pinned
  if (url.includes('/pinned')) {
    try {
      const resources = db.prepare('SELECT resource_uuid, resource_name, resource_kind, instance_id FROM resources LIMIT 5').all() || [];
      const pinned = resources.map((r: any) => ({
        uuid: r.resource_uuid,
        name: r.resource_name,
        kind: r.resource_kind,
        cpuUsage: r.resource_uuid === 'vm-007' ? 94 : 78,
        memUsage: r.resource_uuid === 'vm-007' ? 82 : 65,
        status: r.resource_uuid === 'vm-007' ? 'WARNING' : 'HEALTHY'
      }));
      return res.json(pinned);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/objects/tree
  if (url.includes('/tree')) {
    try {
      const instances = db.prepare('SELECT id, name FROM vcf_instances').all() || [];
      const resources = db.prepare('SELECT resource_uuid, resource_name, resource_kind, instance_id FROM resources').all() || [];

      const tree = instances.map((inst: any) => {
        const instResources = resources.filter((r: any) => r.instance_id === inst.id);
        const clusters = instResources.filter((r: any) => r.resource_kind === 'ClusterComputeResource').map((c: any) => {
          const hosts = instResources.filter((r: any) => r.resource_kind === 'HostSystem').map((h: any) => {
            const vms = instResources.filter((r: any) => r.resource_kind === 'VirtualMachine').map((vm: any) => ({
              id: vm.resource_uuid,
              name: vm.resource_name
            }));
            return {
              id: h.resource_uuid,
              name: h.resource_name,
              vms
            };
          });
          return {
            id: c.resource_uuid,
            name: c.resource_name,
            hosts
          };
        });

        return {
          id: inst.id,
          name: inst.name,
          clusters
        };
      });

      return res.json(tree);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // GET /api/v1/objects/:resourceUuid
  const parts = url.split('?')[0].split('/');
  const resourceUuid = req.params?.resourceUuid || parts[parts.length - 1] || 'vm-007';

  try {
    const resRow = db.prepare('SELECT * FROM resources WHERE resource_uuid = ?').get(resourceUuid);
    if (!resRow && resourceUuid !== 'objects') {
      return res.status(404).json({ error: `Resource ${resourceUuid} not found.` });
    }

    const row = resRow || {
      resource_uuid: 'vm-007',
      resource_name: 'VM-007 (SQL-Prod)',
      resource_kind: 'VirtualMachine',
      instance_id: 'vcf-ops-01'
    };

    return res.json({
      resourceUuid: row.resource_uuid,
      resourceName: row.resource_name,
      resourceKind: row.resource_kind,
      vcfInstance: row.instance_id,
      ipAddress: '10.20.30.45',
      guestOs: 'RHEL 9 (64-bit)',
      hierarchy: {
        vCenter: 'vc-01.corp.local',
        cluster: 'Cluster-vSAN-01',
        host: 'esx-01.corp.local',
        datastore: 'vsanDatastore'
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
