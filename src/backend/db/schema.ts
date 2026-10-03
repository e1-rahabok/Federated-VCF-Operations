/**
 * Relational Database Schema Definitions (Prisma / Kysely / SQLite)
 */

export interface VcfInstance {
  id: string;
  name: string;
  hostname: string;
  authType: 'OPS_TOKEN' | 'BEARER_TOKEN';
  username: string;
  passwordEncrypted: string;
  enabled: boolean;
}

export interface Resource {
  instanceId: string;
  resourceUuid: string;
  resourceName: string;
  resourceKind: string;
  adapterKind: string;
  lastSeen: Date;
}

export interface Alert {
  alertId: string;
  instanceId: string;
  resourceUuid: string;
  alertLevel: 'CRITICAL' | 'IMMEDIATE' | 'WARNING' | 'INFO';
  status: 'ACTIVE' | 'CANCELED' | 'SUSPENDED';
  startTime: Date;
  updateTime: Date;
  cancelTime?: Date;
}

export interface RawMetric {
  id: number;
  instanceId: string;
  resourceUuid: string;
  statKey: string;
  timestamp: number;
  statValue: number;
}

export interface SummaryMetric {
  id: number;
  instanceId: string;
  resourceUuid: string;
  statKey: string;
  timeBucket: Date;
  granularity: '5MIN' | '1HOUR';
  valMin: number;
  valMax: number;
  valAvg: number;
  valP95: number;
  sampleCount: number;
}
