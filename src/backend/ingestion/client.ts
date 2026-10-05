import { CONFIG } from '../config.ts';
import { decryptSecret } from '../utils/encryption.ts';
import { httpRequest } from './http.ts';

export interface VcfInstanceConfig {
  id: string;
  name: string;
  hostname: string;
  authType: 'OPS_TOKEN' | 'BEARER_TOKEN';
  username?: string;
  passwordEncrypted?: string;
  authSource?: string;
  vidbHost?: string;
  clientId?: string;
  refreshTokenEncrypted?: string;
  verifyTls?: boolean | number;
}

export interface VcfResource {
  uuid: string;
  name: string;
  kind: string;
  adapterKind: string;
}

export interface VcfMetricPoint {
  resourceUuid: string;
  statKey: string;
  timestamp: number;
  statValue: number;
}

export interface VcfAlert {
  alertId: string;
  resourceUuid: string;
  alertName: string;
  severity: string;
  status: string;
  startTime: number;
  updateTime: number;
  cancelTime: number | null;
}

export interface VcfProperty {
  resourceUuid: string;
  key: string;
  value: string;
}

export interface VcfRelation {
  resourceUuid: string;
  relatedUuid: string;
  relatedName: string;
  relatedKind: string;
}

export interface VcfAlertCondition {
  alertId: string;
  symptomId: string;
  statKey: string;
  operator: string;
  threshold: string;
  severity: string;
}

export interface AlertQuery {
  activeOnly?: boolean;
  alertId?: string[];
  updateTimeRange?: { startTime: number; endTime: number };
  cancelTimeRange?: { startTime: number; endTime: number };
}

export class VcfOpsApiError extends Error {
  public status: number;

  constructor(message: string, status: number = 0) {
    super(message);
    this.name = 'VcfOpsApiError';
    this.status = status;
  }
}

const SUITE_API = '/suite-api/api';
const PAGE_SIZE = 1000;
const MAX_PAGES = 500;
const STATS_RESOURCE_BATCH = 200;
// Alert ids travel in the query string of the contributing-symptoms call, so batches stay small.
const ALERT_ID_BATCH = 50;
// Refresh this long before the token's stated expiry.
const TOKEN_RENEW_MARGIN_MS = 5 * 60 * 1000;
// VCF Identity Broker tenant used when the instance does not name one.
const DEFAULT_VIDB_TENANT = 'CUSTOMER';

/**
 * Turns a configured hostname into a base URL. Always HTTPS unless the operator
 * explicitly enabled ALLOW_INSECURE_HTTP and wrote the hostname as "http://...".
 */
export function resolveBaseUrl(hostname: string): string {
  const value = (hostname || '').trim().replace(/\/+$/, '');
  if (!value) throw new VcfOpsApiError('Hostname is required.');
  if (value.startsWith('http://')) {
    if (!CONFIG.ALLOW_INSECURE_HTTP) {
      throw new VcfOpsApiError('Plain HTTP is not allowed. Use an HTTPS hostname, or set ALLOW_INSECURE_HTTP=true for lab use.');
    }
    return value;
  }
  return value.startsWith('https://') ? value : `https://${value}`;
}

// The API reports INFORMATION; the rest of this application uses INFO.
function normalizeSeverity(alertLevel: string): string {
  const level = (alertLevel || 'UNKNOWN').toUpperCase();
  return level === 'INFORMATION' ? 'INFO' : level;
}

export class VcfOpsApiClient {
  private config: VcfInstanceConfig;
  private baseUrl: string;
  private timeoutMs: number;
  private rejectUnauthorized: boolean;
  private tokenCache: { header: string; expiresAt: number } | null = null;

  constructor(config: VcfInstanceConfig) {
    this.config = config;
    this.baseUrl = resolveBaseUrl(config.hostname);
    this.timeoutMs = CONFIG.API_TIMEOUT_SECONDS * 1000;
    this.rejectUnauthorized = !(config.verifyTls === false || config.verifyTls === 0);
  }

  /** Returns the full Authorization header value, acquiring or renewing the token when needed. */
  public async getAuthToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt - TOKEN_RENEW_MARGIN_MS > Date.now()) {
      return this.tokenCache.header;
    }
    this.tokenCache = this.config.authType === 'BEARER_TOKEN'
      ? await this.acquireBearerToken()
      : await this.acquireOpsToken();
    return this.tokenCache.header;
  }

  // Option A: POST /suite-api/api/auth/token/acquire -> "OpsToken <token>"
  private async acquireOpsToken(): Promise<{ header: string; expiresAt: number }> {
    const password = decryptSecret(this.config.passwordEncrypted || '');
    if (!this.config.username || !password) {
      throw new VcfOpsApiError(`Instance ${this.config.name} has no username/password configured.`);
    }

    const res = await httpRequest({
      method: 'POST',
      url: `${this.baseUrl}${SUITE_API}/auth/token/acquire`,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        username: this.config.username,
        password,
        authSource: this.config.authSource || 'LOCAL'
      }),
      timeoutMs: this.timeoutMs,
      rejectUnauthorized: this.rejectUnauthorized
    });

    if (res.status !== 200) {
      throw new VcfOpsApiError(`Token acquire failed with HTTP ${res.status}: ${describeBody(res.body)}`, res.status);
    }
    const data = parseJson(res.body);
    if (!data.token) {
      throw new VcfOpsApiError('Token acquire response did not contain a token.', res.status);
    }
    // "validity" is the expiry as epoch milliseconds.
    const expiresAt = Number(data.validity) > Date.now() ? Number(data.validity) : Date.now() + 30 * 60 * 1000;
    return { header: `OpsToken ${data.token}`, expiresAt };
  }

  // Option B: exchange a VCF SSO API token at the VCF Identity Broker -> "Bearer <access_token>"
  private async acquireBearerToken(): Promise<{ header: string; expiresAt: number }> {
    const apiToken = decryptSecret(this.config.refreshTokenEncrypted || '');
    if (!this.config.vidbHost || !apiToken) {
      throw new VcfOpsApiError(`Instance ${this.config.name} has no VIDB host/API token configured.`);
    }

    const tenant = encodeURIComponent(this.config.clientId || DEFAULT_VIDB_TENANT);
    const form = new URLSearchParams({
      grant_type: 'urn:custom:vcf:params:oauth:grant-type:api-token',
      api_token: apiToken
    });

    const res = await httpRequest({
      method: 'POST',
      url: `${resolveBaseUrl(this.config.vidbHost)}/acs/t/${tenant}/token`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form.toString(),
      timeoutMs: this.timeoutMs,
      rejectUnauthorized: this.rejectUnauthorized
    });

    if (res.status !== 200) {
      throw new VcfOpsApiError(`VIDB token exchange failed with HTTP ${res.status}: ${describeBody(res.body)}`, res.status);
    }
    const data = parseJson(res.body);
    if (!data.access_token) {
      throw new VcfOpsApiError('VIDB token response did not contain an access_token.', res.status);
    }
    const lifetimeSeconds = Number(data.expires_in) > 0 ? Number(data.expires_in) : 30 * 60;
    return { header: `Bearer ${data.access_token}`, expiresAt: Date.now() + lifetimeSeconds * 1000 };
  }

  private async request(method: 'GET' | 'POST', path: string, query?: URLSearchParams, body?: any): Promise<any> {
    const url = `${this.baseUrl}${SUITE_API}${path}${query ? `?${query.toString()}` : ''}`;

    const send = async () => httpRequest({
      method,
      url,
      headers: {
        Authorization: await this.getAuthToken(),
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      timeoutMs: this.timeoutMs,
      rejectUnauthorized: this.rejectUnauthorized
    });

    let res = await send();
    if (res.status === 401) {
      // Token revoked or expired early: acquire a fresh one and retry once.
      this.tokenCache = null;
      res = await send();
    }
    if (res.status < 200 || res.status >= 300) {
      throw new VcfOpsApiError(`${method} ${path} failed with HTTP ${res.status}: ${describeBody(res.body)}`, res.status);
    }
    return parseJson(res.body);
  }

  /** Authenticates and reads the product version. Used by "Test Connection". */
  public async testConnection(): Promise<{ releaseName: string }> {
    const version = await this.request('GET', '/versions/current');
    return { releaseName: version.releaseName || version.humanlyReadableReleaseDate || 'unknown version' };
  }

  /** GET /suite-api/api/resources, all pages, for the given resource kinds. */
  public async fetchObjects(resourceKinds: string[], adapterKind: string = 'VMWARE'): Promise<VcfResource[]> {
    if (resourceKinds.length === 0) return [];
    const resources: VcfResource[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ adapterKind, page: String(page), pageSize: String(PAGE_SIZE) });
      for (const kind of resourceKinds) query.append('resourceKind', kind);

      const data = await this.request('GET', '/resources', query);
      const list: any[] = data.resourceList || [];
      for (const r of list) {
        if (!r.identifier || !r.resourceKey) continue;
        resources.push({
          uuid: r.identifier,
          name: r.resourceKey.name || r.identifier,
          kind: r.resourceKey.resourceKindKey,
          adapterKind: r.resourceKey.adapterKindKey
        });
      }

      const total = Number(data.pageInfo?.totalCount ?? resources.length);
      if (list.length === 0 || resources.length >= total) break;
    }

    return resources;
  }

  /**
   * POST /suite-api/api/resources/stats/query for samples with begin <= timestamp <= end.
   * No rollUpType is sent, so VCF Operations returns the samples as collected.
   */
  public async fetchMetricsDelta(resourceUuids: string[], statKeys: string[], begin: number, end: number): Promise<VcfMetricPoint[]> {
    const points: VcfMetricPoint[] = [];
    if (resourceUuids.length === 0 || statKeys.length === 0 || begin > end) return points;

    for (let i = 0; i < resourceUuids.length; i += STATS_RESOURCE_BATCH) {
      const data = await this.request('POST', '/resources/stats/query', undefined, {
        resourceId: resourceUuids.slice(i, i + STATS_RESOURCE_BATCH),
        statKey: statKeys,
        begin,
        end
      });

      for (const entry of data.values || []) {
        for (const stat of entry['stat-list']?.stat || []) {
          const key = stat.statKey?.key;
          const timestamps: number[] = stat.timestamps || [];
          const values: number[] = stat.data || [];
          if (!key) continue;
          for (let n = 0; n < timestamps.length && n < values.length; n++) {
            const value = Number(values[n]);
            if (!Number.isFinite(value)) continue;
            points.push({ resourceUuid: entry.resourceId, statKey: key, timestamp: Number(timestamps[n]), statValue: value });
          }
        }
      }
    }

    return points;
  }

  /**
   * POST /suite-api/api/resources/properties/latest/query - latest value of each property key.
   * Text properties arrive in "values", numeric ones in "data".
   */
  public async fetchProperties(resourceUuids: string[], propertyKeys: string[]): Promise<VcfProperty[]> {
    const properties: VcfProperty[] = [];
    if (resourceUuids.length === 0 || propertyKeys.length === 0) return properties;

    for (let i = 0; i < resourceUuids.length; i += STATS_RESOURCE_BATCH) {
      const data = await this.request('POST', '/resources/properties/latest/query', undefined, {
        resourceIds: resourceUuids.slice(i, i + STATS_RESOURCE_BATCH),
        propertyKeys
      });

      for (const entry of data.values || []) {
        for (const content of entry['property-contents']?.['property-content'] || []) {
          const series: any[] = (content.values && content.values.length > 0) ? content.values : (content.data || []);
          if (!content.statKey || series.length === 0) continue;
          const latest = series[series.length - 1];
          if (latest === null || latest === undefined || latest === '') continue;
          properties.push({ resourceUuid: entry.resourceId, key: content.statKey, value: String(latest) });
        }
      }
    }

    return properties;
  }

  /**
   * POST /suite-api/api/resources/bulk/relationships. Each returned entry is a related
   * object of one of `relatedKinds`, with the requested resources it relates to.
   */
  public async fetchRelated(resourceUuids: string[], relationshipType: 'ANCESTOR' | 'CHILD', relatedKinds: string[]): Promise<VcfRelation[]> {
    const relations: VcfRelation[] = [];
    if (resourceUuids.length === 0 || relatedKinds.length === 0) return relations;

    for (let i = 0; i < resourceUuids.length; i += STATS_RESOURCE_BATCH) {
      const body = {
        relationshipType,
        resourceIds: resourceUuids.slice(i, i + STATS_RESOURCE_BATCH),
        resourceQuery: { resourceKind: relatedKinds },
        ...(relationshipType === 'ANCESTOR' ? { hierarchyDepth: 6 } : {})
      };

      let received = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        const data = await this.request('POST', '/resources/bulk/relationships', query, body);
        const list: any[] = data.resourcesRelations || [];

        for (const entry of list) {
          const related = entry.resource;
          if (!related?.identifier || !related.resourceKey) continue;
          for (const resourceUuid of entry.relatedResources || []) {
            relations.push({
              resourceUuid,
              relatedUuid: related.identifier,
              relatedName: related.resourceKey.name || related.identifier,
              relatedKind: related.resourceKey.resourceKindKey
            });
          }
        }

        received += list.length;
        const total = Number(data.pageInfo?.totalCount ?? received);
        if (list.length === 0 || received >= total) break;
      }
    }

    return relations;
  }

  /**
   * GET /suite-api/api/alerts/contributingsymptoms?id=... - the symptom conditions (stat key,
   * operator, threshold) behind each alert. Symptoms without a metric condition are skipped.
   */
  public async fetchAlertConditions(alertIds: string[]): Promise<VcfAlertCondition[]> {
    const conditions: VcfAlertCondition[] = [];

    for (let i = 0; i < alertIds.length; i += ALERT_ID_BATCH) {
      const query = new URLSearchParams();
      for (const id of alertIds.slice(i, i + ALERT_ID_BATCH)) query.append('id', id);
      const data = await this.request('GET', '/alerts/contributingsymptoms', query);

      for (const alertEntry of data.contributingSymptoms || []) {
        for (const symptom of alertEntry.contributingSymptoms?.contributingSymptoms || []) {
          for (const alertCondition of symptom.alertConditions || []) {
            const condition = alertCondition.condition;
            if (!alertEntry.alertId || !condition?.key) continue;
            conditions.push({
              alertId: alertEntry.alertId,
              symptomId: symptom.symptomId || alertCondition.id || condition.key,
              statKey: condition.key,
              operator: condition.operator || '',
              threshold: condition.value !== undefined && condition.value !== null ? String(condition.value) : '',
              severity: normalizeSeverity(alertCondition.severity)
            });
          }
        }
      }
    }

    return conditions;
  }

  /** POST /suite-api/api/alerts/query, all pages. */
  public async fetchAlerts(alertQuery: AlertQuery): Promise<VcfAlert[]> {
    const alerts: VcfAlert[] = [];

    for (let page = 0; page < MAX_PAGES; page++) {
      const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const data = await this.request('POST', '/alerts/query', query, alertQuery);
      const list: any[] = data.alerts || [];

      for (const a of list) {
        if (!a.alertId) continue;
        const cancelTime = Number(a.cancelTimeUTC) > 0 ? Number(a.cancelTimeUTC) : null;
        alerts.push({
          alertId: a.alertId,
          resourceUuid: a.resourceId || '',
          alertName: a.alertDefinitionName || a.alertDefinitionId || a.alertId,
          severity: normalizeSeverity(a.alertLevel),
          status: (a.status || 'ACTIVE').toUpperCase(),
          startTime: Number(a.startTimeUTC) || 0,
          updateTime: Number(a.updateTimeUTC) || Number(a.startTimeUTC) || 0,
          cancelTime
        });
      }

      const total = Number(data.pageInfo?.totalCount ?? alerts.length);
      if (list.length === 0 || alerts.length >= total) break;
    }

    return alerts;
  }
}

function parseJson(body: string): any {
  try {
    return JSON.parse(body);
  } catch (err) {
    throw new VcfOpsApiError(`Expected a JSON response but received: ${describeBody(body)}`);
  }
}

function describeBody(body: string): string {
  const text = (body || '').trim();
  if (!text) return '(empty response)';
  return text.length > 200 ? `${text.substring(0, 200)}...` : text;
}
