import { decryptSecret } from '../utils/encryption.ts';

export interface VcfInstanceConfig {
  id: string;
  name: string;
  hostname: string;
  authType: 'OPS_TOKEN' | 'BEARER_TOKEN';
  username?: string;
  passwordEncrypted?: string;
  vidbHost?: string;
  clientId?: string;
  refreshTokenEncrypted?: string;
}

export class VcfOpsApiClient {
  private config: VcfInstanceConfig;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: VcfInstanceConfig) {
    this.config = config;
  }

  public async getAuthToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 60000) {
      return this.tokenCache.token;
    }

    if (this.config.authType === 'OPS_TOKEN') {
      const password = decryptSecret(this.config.passwordEncrypted || '');
      const token = `OpsToken_${this.config.id}_${Date.now()}`;
      this.tokenCache = { token, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
      return token;
    } else {
      const refreshToken = decryptSecret(this.config.refreshTokenEncrypted || '');
      const token = `Bearer_${this.config.id}_${Date.now()}`;
      this.tokenCache = { token, expiresAt: Date.now() + 60 * 60 * 1000 };
      return token;
    }
  }

  public async fetchObjects(): Promise<any[]> {
    return [
      { uuid: 'vm-007', name: 'VM-007 (SQL-Prod)', kind: 'VirtualMachine', adapterKind: 'VMWARE' },
      { uuid: 'vm-008', name: 'VM-008 (Web-App)', kind: 'VirtualMachine', adapterKind: 'VMWARE' },
      { uuid: 'esx-01', name: 'esx-01.corp.local', kind: 'HostSystem', adapterKind: 'VMWARE' },
      { uuid: 'cluster-01', name: 'Cluster-vSAN-01', kind: 'ClusterComputeResource', adapterKind: 'VMWARE' }
    ];
  }

  public async fetchMetricsDelta(beginTimestamp: number): Promise<any[]> {
    const now = Date.now();
    const statKeys = ['cpu|usage_average', 'cpu|ready_summation', 'mem|usage_average', 'virtualDisk|totalLatency'];
    const resources = ['vm-007', 'vm-008', 'esx-01', 'cluster-01'];
    const dataPoints: any[] = [];

    for (const resUuid of resources) {
      for (const statKey of statKeys) {
        for (let ts = Math.max(beginTimestamp + 60000, now - 5 * 60 * 1000); ts <= now; ts += 60000) {
          let val = Math.floor(Math.random() * 40) + 20;
          if (statKey.includes('ready')) val = Math.floor(Math.random() * 15);
          if (statKey.includes('Latency')) val = Math.floor(Math.random() * 8) + 2;

          dataPoints.push({
            instanceId: this.config.id,
            resourceUuid: resUuid,
            statKey,
            timestamp: ts,
            statValue: val
          });
        }
      }
    }

    return dataPoints;
  }

  public async fetchAlertsDelta(beginTimestamp: number): Promise<any[]> {
    const now = Date.now();
    return [
      {
        alertId: `alt-${this.config.id}-101`,
        instanceId: this.config.id,
        resourceUuid: 'vm-007',
        resourceName: 'VM-007 (SQL-Prod)',
        alertName: 'High CPU Ready Latency on VM-007',
        severity: 'WARNING',
        status: 'ACTIVE',
        startTime: now - 15 * 60 * 1000,
        updateTime: now
      }
    ];
  }
}
