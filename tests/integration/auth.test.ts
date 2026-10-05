import crypto from 'node:crypto';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { getDatabase } from '../../src/backend/db/database.ts';
import { CONFIG } from '../../src/backend/config.ts';
import { issueToken } from '../../src/backend/auth.ts';
import { startTestApp, TEST_ADMIN } from '../helpers/testApp.ts';

let app: Awaited<ReturnType<typeof startTestApp>>;

beforeAll(async () => {
  app = await startTestApp();
});

afterAll(() => app.stop());

const PROTECTED_READS = ['/instances', '/alerts', '/alerts/summary', '/objects/tree', '/metrics/keys?resourceUuid=x', '/system/status', '/system/config/metrics', '/users/preferences', '/auth/me', '/auth/users'];

test('The bootstrap administrator is stored with a salted scrypt hash, never the password', () => {
  const row = getDatabase().prepare("SELECT password_hash, role FROM users WHERE username = 'admin'").get();
  expect(row.role).toBe('ADMIN');
  expect(row.password_hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  expect(row.password_hash).not.toContain(TEST_ADMIN.password);
});

test('Every API route except sign-in rejects anonymous requests; health probes stay open', async () => {
  const anonymous = app.as(null);
  for (const path of PROTECTED_READS) {
    const res = await anonymous.get(path);
    expect([path, res.status]).toEqual([path, 401]);
    expect(res.body.error).toBe('Authentication required.');
  }
  expect((await anonymous.post('/instances', { name: 'x', hostname: 'x.example' })).status).toBe(401);
  expect((await anonymous.put('/system/settings/retention', { rawHours: 24, summaryDays: 60 })).status).toBe(401);
  expect((await anonymous.del('/instances/anything')).status).toBe(401);
  expect(getDatabase().prepare('SELECT count(*) as count FROM vcf_instances').get().count).toBe(0);

  expect((await fetch(`${app.baseUrl}/healthz`)).status).toBe(200);
});

test('Sign-in checks the stored credentials and returns a session token plus an HttpOnly cookie', async () => {
  const anonymous = app.as(null);

  expect((await anonymous.post('/auth/login', { username: 'admin', password: 'wrong-password' })).status).toBe(401);
  expect((await anonymous.post('/auth/login', { username: 'nobody', password: TEST_ADMIN.password })).status).toBe(401);
  expect((await anonymous.post('/auth/login', { username: 'admin' })).status).toBe(400);
  // The value the old placeholder login accepted for any account is not special.
  expect((await anonymous.post('/auth/login', { username: 'admin', password: 'admin123' })).status).toBe(401);

  const ok = await anonymous.post('/auth/login', TEST_ADMIN);
  expect(ok.status).toBe(200);
  expect(ok.body.user).toEqual({ username: 'admin', role: 'ADMIN' });
  expect(ok.body.token.split('.')).toHaveLength(3);

  const cookie = ok.headers.get('set-cookie')!;
  expect(cookie).toContain('fvo_session=');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('SameSite=Strict');

  // Bearer header
  expect((await app.as(ok.body.token).get('/auth/me')).body).toEqual({ username: 'admin', role: 'ADMIN' });
  // Cookie only (what the browser sends after a page reload)
  const viaCookie = await fetch(`${app.baseUrl}/api/v1/auth/me`, { headers: { Cookie: cookie.split(';')[0] } });
  expect(viaCookie.status).toBe(200);
  expect(await viaCookie.json()).toEqual({ username: 'admin', role: 'ADMIN' });

  const logout = await anonymous.post('/auth/logout', {});
  expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
});

test('Forged, tampered and expired tokens are rejected', async () => {
  const [header, payload, signature] = app.token.split('.');

  // Payload changed to another user without re-signing
  const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: 'root' })).toString('base64url');
  expect((await app.as(`${header}.${forgedPayload}.${signature}`).get('/auth/me')).status).toBe(401);

  // Correct structure signed with a different secret
  const wrongKeySignature = crypto.createHmac('sha256', 'not-the-server-secret').update(`${header}.${payload}`).digest('base64url');
  expect((await app.as(`${header}.${payload}.${wrongKeySignature}`).get('/auth/me')).status).toBe(401);

  // Unsigned "alg: none" token
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  expect((await app.as(`${noneHeader}.${payload}.`).get('/auth/me')).status).toBe(401);

  // Genuine token issued longer ago than the session lifetime
  const expired = issueToken({ username: 'admin', role: 'ADMIN', tokenVersion: 1 }, Date.now() - (CONFIG.SESSION_HOURS * 60 * 60 * 1000 + 1000));
  expect((await app.as(expired).get('/auth/me')).status).toBe(401);

  expect((await app.as('garbage').get('/auth/me')).status).toBe(401);
  expect((await app.get('/auth/me')).status).toBe(200);
});

test('Role-based access: a viewer can read and keep own preferences but cannot change configuration', async () => {
  expect((await app.post('/auth/users', { username: 'viewer1', password: 'short', role: 'VIEWER' })).status).toBe(400);
  expect((await app.post('/auth/users', { username: 'viewer1', password: 'Viewer-Pw-12345', role: 'OWNER' })).status).toBe(400);
  expect((await app.post('/auth/users', { username: 'viewer1', password: 'Viewer-Pw-12345', role: 'VIEWER' })).status).toBe(201);
  expect((await app.post('/auth/users', { username: 'viewer1', password: 'Viewer-Pw-12345', role: 'VIEWER' })).status).toBe(400);
  expect((await app.get('/auth/users')).body.map((u: any) => [u.username, u.role])).toEqual([['admin', 'ADMIN'], ['viewer1', 'VIEWER']]);

  const login = await app.as(null).post('/auth/login', { username: 'viewer1', password: 'Viewer-Pw-12345' });
  expect(login.body.user).toEqual({ username: 'viewer1', role: 'VIEWER' });
  const viewer = app.as(login.body.token);

  // Reads are allowed
  expect((await viewer.get('/instances')).status).toBe(200);
  expect((await viewer.get('/alerts')).status).toBe(200);
  expect((await viewer.get('/system/status')).status).toBe(200);

  // Changes are refused and leave no trace
  const refused = [
    await viewer.post('/instances', { name: 'Rogue', hostname: 'rogue.example' }),
    await viewer.post('/instances/test', { hostname: 'rogue.example' }),
    await viewer.del('/instances/anything'),
    await viewer.put('/system/settings/retention', { rawHours: 12, summaryDays: 30 }),
    await viewer.put('/system/config/metrics', { yaml: 'version: "9"' }),
    await viewer.post('/auth/users', { username: 'viewer2', password: 'Viewer-Pw-12345', role: 'ADMIN' }),
    await viewer.del('/auth/users/admin')
  ];
  expect(refused.map(r => r.status)).toEqual([403, 403, 403, 403, 403, 403, 403]);
  expect((await viewer.get('/auth/users')).status).toBe(403);
  expect(getDatabase().prepare('SELECT count(*) as count FROM vcf_instances').get().count).toBe(0);
  expect((await app.get('/system/status')).body.retention).toEqual({ rawHours: 48, summaryDays: 90 });
  expect((await app.get('/system/config/metrics')).body.yaml).toContain('VirtualMachine');

  // Preferences belong to the signed-in user
  expect((await viewer.put('/users/preferences', { hiddenWidgets: ['QUICK_LAUNCHER'] })).status).toBe(200);
  expect((await viewer.get('/users/preferences')).body.hiddenWidgets).toEqual(['QUICK_LAUNCHER']);
  expect((await app.get('/users/preferences')).body.hiddenWidgets).toEqual([]);
});

test('Changing a password requires the current one and revokes tokens issued before the change', async () => {
  const before = await app.as(null).post('/auth/login', { username: 'viewer1', password: 'Viewer-Pw-12345' });
  const oldSession = app.as(before.body.token);

  expect((await oldSession.post('/auth/password', { currentPassword: 'wrong', newPassword: 'New-Viewer-Pw-999' })).status).toBe(400);
  expect((await oldSession.post('/auth/password', { currentPassword: 'Viewer-Pw-12345', newPassword: 'tiny' })).status).toBe(400);

  const changed = await oldSession.post('/auth/password', { currentPassword: 'Viewer-Pw-12345', newPassword: 'New-Viewer-Pw-999' });
  expect(changed.status).toBe(200);

  expect((await oldSession.get('/auth/me')).status).toBe(401);
  expect((await app.as(changed.body.token).get('/auth/me')).body).toEqual({ username: 'viewer1', role: 'VIEWER' });
  expect((await app.as(null).post('/auth/login', { username: 'viewer1', password: 'Viewer-Pw-12345' })).status).toBe(401);
  expect((await app.as(null).post('/auth/login', { username: 'viewer1', password: 'New-Viewer-Pw-999' })).status).toBe(200);
});

test('Deleting a user ends their session; the last administrator and the own account are protected', async () => {
  const login = await app.as(null).post('/auth/login', { username: 'viewer1', password: 'New-Viewer-Pw-999' });
  const viewer = app.as(login.body.token);
  expect((await viewer.get('/auth/me')).status).toBe(200);

  expect((await app.del('/auth/users/admin')).body.error).toBe('You cannot delete the account you are signed in with.');
  expect((await app.del('/auth/users/viewer1')).status).toBe(200);
  expect((await viewer.get('/auth/me')).status).toBe(401);
  expect(getDatabase().prepare("SELECT count(*) as count FROM user_preferences WHERE username = 'viewer1'").get().count).toBe(0);

  // A second admin cannot remove the only other admin's protection either: with two admins one may go, the last may not.
  expect((await app.post('/auth/users', { username: 'admin2', password: 'Second-Admin-Pw-1', role: 'ADMIN' })).status).toBe(201);
  const admin2 = app.as((await app.as(null).post('/auth/login', { username: 'admin2', password: 'Second-Admin-Pw-1' })).body.token);
  expect((await admin2.del('/auth/users/admin')).status).toBe(200);
  expect((await admin2.del('/auth/users/admin2')).status).toBe(400);
  expect((await admin2.get('/auth/users')).body.map((u: any) => u.username)).toEqual(['admin2']);
});

test('Repeated failed sign-ins lock the username out, even for the correct password', async () => {
  const anonymous = app.as(null);
  for (let attempt = 0; attempt < 5; attempt++) {
    expect((await anonymous.post('/auth/login', { username: 'admin2', password: `guess-${attempt}` })).status).toBe(401);
  }
  const locked = await anonymous.post('/auth/login', { username: 'admin2', password: 'Second-Admin-Pw-1' });
  expect(locked.status).toBe(429);
  expect(locked.body.error).toContain('Too many failed sign-in attempts');
});
