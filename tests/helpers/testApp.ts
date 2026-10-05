import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/backend/app.ts';

export const TEST_ADMIN = { username: 'admin', password: 'Test-Admin-Pw-1' };

/**
 * Starts the real application on a free port, signs in as the bootstrap administrator and
 * returns JSON request helpers that send that session token.
 */
export async function startTestApp() {
  const server: Server = await new Promise(resolve => {
    const s = createApp().listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const request = async (token: string | null, method: string, path: string, body?: any) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };

  const login = await request(null, 'POST', '/auth/login', TEST_ADMIN);
  if (login.status !== 200) throw new Error(`Test admin login failed: ${JSON.stringify(login.body)}`);
  const token: string = login.body.token;
  const send = (method: string, path: string, body?: any) => request(token, method, path, body);

  return {
    baseUrl,
    token,
    // Same helpers with an explicit token (or null for an anonymous request)
    as: (otherToken: string | null) => ({
      get: (path: string) => request(otherToken, 'GET', path),
      post: (path: string, body: any) => request(otherToken, 'POST', path, body),
      put: (path: string, body: any) => request(otherToken, 'PUT', path, body),
      del: (path: string) => request(otherToken, 'DELETE', path)
    }),
    get: (path: string) => send('GET', path),
    post: (path: string, body: any) => send('POST', path, body),
    put: (path: string, body: any) => send('PUT', path, body),
    del: (path: string) => send('DELETE', path),
    stop: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}
