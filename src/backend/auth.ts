import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { CONFIG } from './config.ts';
import { getDatabase } from './db/database.ts';

export type Role = 'ADMIN' | 'VIEWER';

export interface AuthUser {
  username: string;
  role: Role;
}

export const SESSION_COOKIE = 'fvo_session';
export const MIN_PASSWORD_LENGTH = 8;
const SESSION_MS = CONFIG.SESSION_HOURS * 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------
// Passwords: scrypt with a per-user random salt, stored as "scrypt:<salt>:<hash>" (hex).
// ---------------------------------------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = (stored || '').split(':');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------------------
// Session tokens: HS256 JWT signed with JWT_SECRET. "ver" ties the token to the user's
// current token_version, so changing a password or deleting a user invalidates old tokens.
// ---------------------------------------------------------------------------------------

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string): string {
  return crypto.createHmac('sha256', CONFIG.JWT_SECRET).update(data).digest('base64url');
}

export function issueToken(user: { username: string; role: Role; tokenVersion: number }, now: number = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: user.username,
    role: user.role,
    ver: user.tokenVersion,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + SESSION_MS) / 1000)
  }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

/** Returns the authenticated user, or null when the token is malformed, forged, expired or revoked. */
export function verifyToken(token: string): AuthUser | null {
  const parts = (token || '').split('.');
  if (parts.length !== 3) return null;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const provided = Buffer.from(parts[2]);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;

  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch (err) {
    return null;
  }
  if (!payload?.sub || typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;

  const user = findUser(payload.sub);
  if (!user || user.tokenVersion !== payload.ver) return null;
  return { username: user.username, role: user.role };
}

// ---------------------------------------------------------------------------------------
// User store
// ---------------------------------------------------------------------------------------

interface StoredUser {
  username: string;
  passwordHash: string;
  role: Role;
  tokenVersion: number;
  createdAt: number;
}

export function findUser(username: string): StoredUser | undefined {
  return getDatabase()
    .prepare('SELECT username, password_hash as passwordHash, role, token_version as tokenVersion, created_at as createdAt FROM users WHERE username = ?')
    .get(username);
}

export function listUsers(): Array<{ username: string; role: Role; createdAt: number }> {
  return getDatabase().prepare('SELECT username, role, created_at as createdAt FROM users ORDER BY username ASC').all() || [];
}

function assertValidPassword(password: any): void {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

export function createUser(username: any, password: any, role: any): void {
  const name = typeof username === 'string' ? username.trim() : '';
  if (!/^[A-Za-z0-9._@-]{1,64}$/.test(name)) {
    throw new Error('Username may contain letters, digits and . _ @ - (1 to 64 characters).');
  }
  if (role !== 'ADMIN' && role !== 'VIEWER') {
    throw new Error('Role must be ADMIN or VIEWER.');
  }
  assertValidPassword(password);
  if (findUser(name)) {
    throw new Error(`User ${name} already exists.`);
  }
  getDatabase()
    .prepare('INSERT INTO users (username, password_hash, role, token_version, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(name, hashPassword(password), role, Date.now());
}

/** Stores a new password and revokes every token issued before the change. */
export function setPassword(username: string, password: any): void {
  assertValidPassword(password);
  getDatabase()
    .prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE username = ?')
    .run(hashPassword(password), username);
}

export function deleteUser(username: string): void {
  const db = getDatabase();
  const target = findUser(username);
  if (!target) throw new Error(`User ${username} not found.`);
  if (target.role === 'ADMIN') {
    const admins = db.prepare("SELECT count(*) as count FROM users WHERE role = 'ADMIN'").get();
    if (Number(admins.count) <= 1) throw new Error('The last administrator cannot be deleted.');
  }
  db.prepare('DELETE FROM users WHERE username = ?').run(username);
  db.prepare('DELETE FROM user_preferences WHERE username = ?').run(username);
}

/**
 * Creates the first administrator when the user table is empty. The password comes from
 * ADMIN_PASSWORD; without it a random one is generated and printed once to the server log.
 */
export function ensureInitialAdmin(): void {
  const existing = getDatabase().prepare('SELECT count(*) as count FROM users').get();
  if (Number(existing.count) > 0) return;

  const username = CONFIG.ADMIN_USERNAME;
  const password = CONFIG.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  createUser(username, password, 'ADMIN');

  if (CONFIG.ADMIN_PASSWORD) {
    console.log(`[Auth] Created initial administrator "${username}" with the password from ADMIN_PASSWORD.`);
  } else {
    console.log('=======================================================');
    console.log(`[Auth] Created initial administrator account.`);
    console.log(`[Auth]   Username: ${username}`);
    console.log(`[Auth]   Password: ${password}`);
    console.log('[Auth] This password is shown only once. Sign in and change it under Settings.');
    console.log('=======================================================');
  }
}

// ---------------------------------------------------------------------------------------
// Login throttling: after too many failures for a username, further attempts are refused
// until the window passes. Kept in memory; a restart clears it.
// ---------------------------------------------------------------------------------------

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failedLogins: Map<string, { count: number; firstFailure: number }> = new Map();

export function isLockedOut(username: string): boolean {
  const entry = failedLogins.get(username.toLowerCase());
  if (!entry) return false;
  if (Date.now() - entry.firstFailure > LOCKOUT_MS) {
    failedLogins.delete(username.toLowerCase());
    return false;
  }
  return entry.count >= MAX_FAILED_LOGINS;
}

export function recordLoginFailure(username: string): void {
  const key = username.toLowerCase();
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.firstFailure > LOCKOUT_MS) {
    failedLogins.set(key, { count: 1, firstFailure: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearLoginFailures(username: string): void {
  failedLogins.delete(username.toLowerCase());
}

// ---------------------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------------------

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

function tokenFromRequest(req: Request): string {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.substring('Bearer '.length).trim();

  for (const part of (req.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator !== -1 && part.substring(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.substring(separator + 1).trim());
    }
  }
  return '';
}

/** Rejects the request with 401 unless it carries a valid session token (Bearer header or cookie). */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = verifyToken(tokenFromRequest(req));
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  req.user = user;
  next();
}

/** VIEWER accounts may read; anything that changes state needs ADMIN (REQ-TEC-009). */
export function requireAdminForWrites(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.user?.role === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Administrator role required.' });
}

export function sessionCookie(token: string): string {
  const attributes = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`
  ];
  if (CONFIG.NODE_ENV === 'production') attributes.push('Secure');
  return attributes.join('; ');
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
