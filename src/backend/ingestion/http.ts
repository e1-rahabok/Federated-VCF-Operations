import http from 'node:http';
import https from 'node:https';

export interface HttpRequestOptions {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  // Per-instance certificate validation switch (REQ-TEC-007). Ignored for http:// URLs.
  rejectUnauthorized: boolean;
}

export interface HttpResponse {
  status: number;
  body: string;
}

/**
 * Minimal HTTPS/HTTP request helper. node:https is used directly (instead of fetch)
 * because certificate validation has to be switchable per request.
 */
export function httpRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(options.url);
    const isHttps = target.protocol === 'https:';
    const transport = isHttps ? https : http;

    const headers: Record<string, string> = { ...(options.headers || {}) };
    if (options.body !== undefined) {
      headers['Content-Length'] = String(Buffer.byteLength(options.body));
    }

    const req = transport.request(
      target,
      {
        method: options.method,
        headers,
        ...(isHttps ? { rejectUnauthorized: options.rejectUnauthorized, minVersion: 'TLSv1.2' as const } : {})
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      }
    );

    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error(`Request timed out after ${options.timeoutMs} ms: ${options.method} ${target.host}${target.pathname}`));
    });
    req.on('error', reject);

    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}
