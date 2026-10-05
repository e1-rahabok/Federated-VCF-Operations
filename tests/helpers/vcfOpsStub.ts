import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * A local HTTP server that speaks the subset of the VCF Operations suite-api (and the
 * VCF Identity Broker token endpoint) that the ingestion client uses. Tests point a real
 * VcfOpsApiClient at it, so requests, authentication and response parsing are exercised
 * over the wire exactly as they would be against a live instance.
 */

export interface StubResource {
  identifier: string;
  name: string;
  resourceKind: string;
  adapterKind?: string;
}

export interface StubSample {
  resourceId: string;
  statKey: string;
  timestamp: number;
  value: number;
}

export interface StubAlert {
  alertId: string;
  resourceId: string;
  alertLevel: string;
  status: string;
  alertDefinitionName: string;
  startTimeUTC: number;
  updateTimeUTC: number;
  cancelTimeUTC: number;
}

export interface StubCondition {
  symptomId: string;
  key: string;
  operator: string;
  value: string;
  severity: string;
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  authorization: string;
  body: any;
}

export class VcfOpsStub {
  public resources: StubResource[] = [];
  public samples: StubSample[] = [];
  public alerts: StubAlert[] = [];
  public requests: RecordedRequest[] = [];
  // resourceId -> property key -> latest value (strings are text properties, numbers numeric ones)
  public properties: Record<string, Record<string, string | number>> = {};
  // Direct parent -> child edges of the inventory tree
  public relations: Array<{ parent: string; child: string }> = [];
  // alertId -> symptom conditions that triggered it
  public alertConditions: Record<string, StubCondition[]> = {};
  // Paths that answer HTTP 500, to simulate a partially failing instance
  public failingPaths: Set<string> = new Set();

  public username = 'svc-federated';
  public password = 'S3cret!';
  public apiToken = 'vcf-sso-api-token';
  public releaseName = 'VCF Operations 9.1.0';
  // Page size cap applied by the stub, kept small so tests exercise pagination.
  public maxPageSize = 2;

  private validTokens = new Set<string>();
  private tokenCounter = 0;
  private server: http.Server | null = null;

  public get url(): string {
    const address = this.server!.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  public get tokensIssued(): number {
    return this.tokenCounter;
  }

  public revokeAllTokens(): void {
    this.validTokens.clear();
  }

  public requestsTo(path: string): RecordedRequest[] {
    return this.requests.filter(r => r.path === path);
  }

  public async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => this.handle(req, res, Buffer.concat(chunks).toString('utf8')));
    });
    await new Promise<void>(resolve => this.server!.listen(0, '127.0.0.1', resolve));
  }

  public async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>(resolve => this.server!.close(() => resolve()));
    this.server = null;
  }

  private issueToken(): string {
    this.tokenCounter += 1;
    const token = `stub-token-${this.tokenCounter}`;
    this.validTokens.add(token);
    return token;
  }

  private ancestorsOf(resourceId: string): Set<string> {
    const found = new Set<string>();
    const walk = (id: string) => {
      for (const edge of this.relations) {
        if (edge.child === id && !found.has(edge.parent)) {
          found.add(edge.parent);
          walk(edge.parent);
        }
      }
    };
    walk(resourceId);
    return found;
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse, rawBody: string): void {
    const url = new URL(req.url || '/', 'http://stub');
    const contentType = String(req.headers['content-type'] || '');
    let body: any = rawBody;
    if (contentType.includes('application/json') && rawBody) body = JSON.parse(rawBody);
    if (contentType.includes('x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(rawBody));

    const authorization = String(req.headers.authorization || '');
    this.requests.push({ method: req.method || '', path: url.pathname, query: url.searchParams, authorization, body });

    const send = (status: number, payload: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };

    // --- Token endpoints (no Authorization header required) ---
    if (req.method === 'POST' && url.pathname === '/suite-api/api/auth/token/acquire') {
      if (body.username !== this.username || body.password !== this.password) {
        return send(401, { message: 'Invalid username/password or user is locked.' });
      }
      const validity = Date.now() + 6 * 60 * 60 * 1000;
      return send(200, { token: this.issueToken(), validity, expiresAt: new Date(validity).toUTCString(), roles: [] });
    }

    if (req.method === 'POST' && url.pathname.startsWith('/acs/t/') && url.pathname.endsWith('/token')) {
      if (body.grant_type !== 'urn:custom:vcf:params:oauth:grant-type:api-token' || body.api_token !== this.apiToken) {
        return send(400, { error: 'invalid_grant' });
      }
      return send(200, { access_token: this.issueToken(), token_type: 'Bearer', expires_in: 1800 });
    }

    // --- Everything else needs a token this stub issued ---
    const [scheme, token] = authorization.split(' ');
    if ((scheme !== 'OpsToken' && scheme !== 'Bearer') || !this.validTokens.has(token)) {
      return send(401, { message: 'The provided token for auth scheme "vRealizeOpsToken" is either invalid or has expired.' });
    }

    const page = Number(url.searchParams.get('page') || 0);
    const pageSize = Math.min(Number(url.searchParams.get('pageSize') || 1000), this.maxPageSize);
    const paginate = <T>(items: T[]) => ({
      pageInfo: { totalCount: items.length, page, pageSize },
      items: items.slice(page * pageSize, (page + 1) * pageSize)
    });

    if (this.failingPaths.has(url.pathname)) {
      return send(500, { message: 'Internal Server Error (simulated by stub)' });
    }

    if (req.method === 'POST' && url.pathname === '/suite-api/api/resources/properties/latest/query') {
      const values = (body.resourceIds as string[]).map(resourceId => {
        const content = (body.propertyKeys as string[])
          .filter(key => this.properties[resourceId]?.[key] !== undefined)
          .map(key => {
            const value = this.properties[resourceId][key];
            return typeof value === 'number'
              ? { statKey: key, timestamps: [Date.now()], data: [value] }
              : { statKey: key, timestamps: [Date.now()], values: [value] };
          });
        return { resourceId, 'property-contents': { 'property-content': content } };
      }).filter(v => v['property-contents']['property-content'].length > 0);
      return send(200, { values });
    }

    if (req.method === 'POST' && url.pathname === '/suite-api/api/resources/bulk/relationships') {
      const kinds: string[] = body.resourceQuery?.resourceKind || [];
      const relatedTo = new Map<string, string[]>();
      for (const resourceId of body.resourceIds as string[]) {
        const related = body.relationshipType === 'ANCESTOR'
          ? Array.from(this.ancestorsOf(resourceId))
          : this.relations.filter(e => e.parent === resourceId).map(e => e.child);
        for (const relatedId of related) {
          relatedTo.set(relatedId, [...(relatedTo.get(relatedId) || []), resourceId]);
        }
      }
      const entries = Array.from(relatedTo.entries())
        .map(([relatedId, resourceIds]) => ({ resource: this.resources.find(r => r.identifier === relatedId), resourceIds }))
        .filter(e => e.resource && (kinds.length === 0 || kinds.includes(e.resource.resourceKind)));
      const { pageInfo, items } = paginate(entries);
      return send(200, {
        pageInfo,
        relationshipType: body.relationshipType,
        resourcesRelations: items.map(e => ({
          resource: {
            identifier: e.resource!.identifier,
            resourceKey: { name: e.resource!.name, adapterKindKey: e.resource!.adapterKind || 'VMWARE', resourceKindKey: e.resource!.resourceKind }
          },
          relatedResources: e.resourceIds
        }))
      });
    }

    if (req.method === 'GET' && url.pathname === '/suite-api/api/alerts/contributingsymptoms') {
      const contributingSymptoms = url.searchParams.getAll('id')
        .filter(alertId => this.alertConditions[alertId])
        .map(alertId => ({
          alertId,
          contributingSymptoms: {
            contributingSymptoms: this.alertConditions[alertId].map(c => ({
              symptomId: c.symptomId,
              symptomSetId: `set-${alertId}`,
              symptomDefinitionsIds: [`SymptomDefinition-${c.symptomId}`],
              alertConditions: [{
                id: `condition-${c.symptomId}`,
                severity: c.severity,
                waitCycles: 1,
                cancelCycles: 1,
                condition: { key: c.key, operator: c.operator, value: c.value, valueType: 'NUMERIC', thresholdType: 'STATIC', instanced: false }
              }]
            }))
          }
        }));
      return send(200, { contributingSymptoms });
    }

    if (req.method === 'GET' && url.pathname === '/suite-api/api/versions/current') {
      return send(200, { releaseName: this.releaseName, major: 9, minor: 1 });
    }

    if (req.method === 'GET' && url.pathname === '/suite-api/api/resources') {
      const kinds = url.searchParams.getAll('resourceKind');
      const adapterKind = url.searchParams.get('adapterKind');
      const matching = this.resources.filter(r =>
        (kinds.length === 0 || kinds.includes(r.resourceKind)) &&
        (!adapterKind || (r.adapterKind || 'VMWARE') === adapterKind));
      const { pageInfo, items } = paginate(matching);
      return send(200, {
        pageInfo,
        resourceList: items.map(r => ({
          identifier: r.identifier,
          resourceKey: { name: r.name, adapterKindKey: r.adapterKind || 'VMWARE', resourceKindKey: r.resourceKind, resourceIdentifiers: [] },
          resourceHealth: 'GREEN'
        }))
      });
    }

    if (req.method === 'POST' && url.pathname === '/suite-api/api/resources/stats/query') {
      const ids: string[] = body.resourceId || [];
      const keys: string[] = body.statKey || [];
      const values = ids.map(resourceId => {
        const stat = keys.map(key => {
          const matching = this.samples
            .filter(s => s.resourceId === resourceId && s.statKey === key && s.timestamp >= body.begin && s.timestamp <= body.end)
            .sort((a, b) => a.timestamp - b.timestamp);
          return { statKey: { key }, timestamps: matching.map(s => s.timestamp), data: matching.map(s => s.value) };
        }).filter(s => s.timestamps.length > 0);
        return { resourceId, 'stat-list': { stat } };
      }).filter(v => v['stat-list'].stat.length > 0);
      return send(200, { values });
    }

    if (req.method === 'POST' && url.pathname === '/suite-api/api/alerts/query') {
      const inRange = (value: number, range?: { startTime: number; endTime: number }) =>
        !range || (value >= range.startTime && value <= range.endTime);
      const matching = this.alerts.filter(a =>
        (!body.activeOnly || a.status === 'ACTIVE') &&
        (!body.alertId || body.alertId.includes(a.alertId)) &&
        inRange(a.updateTimeUTC, body.updateTimeRange) &&
        (!body.cancelTimeRange || (a.cancelTimeUTC > 0 && inRange(a.cancelTimeUTC, body.cancelTimeRange))));
      const { pageInfo, items } = paginate(matching);
      return send(200, { pageInfo, alerts: items.map(a => ({ ...a, type: 'Virtualization/Hypervisor Alerts', subType: 'Performance', controlState: 'OPEN', alertImpact: 'HEALTH' })) });
    }

    return send(404, { message: `Stub has no handler for ${req.method} ${url.pathname}` });
  }
}
