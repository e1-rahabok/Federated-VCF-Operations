import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/backend/app.ts';

/** Starts the real application on a free port and returns small JSON request helpers. */
export async function startTestApp() {
  const server: Server = await new Promise(resolve => {
    const s = createApp().listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const send = async (method: string, path: string, body?: any) => {
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json() };
  };

  return {
    baseUrl,
    get: (path: string) => send('GET', path),
    post: (path: string, body: any) => send('POST', path, body),
    put: (path: string, body: any) => send('PUT', path, body),
    del: (path: string) => send('DELETE', path),
    stop: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}
