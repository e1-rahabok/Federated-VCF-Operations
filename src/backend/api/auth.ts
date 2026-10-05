import express from 'express';
import {
  clearLoginFailures, clearedSessionCookie, createUser, deleteUser, findUser, isLockedOut, issueToken, listUsers,
  recordLoginFailure, requireAdminForWrites, requireAuth, sessionCookie, setPassword, verifyPassword
} from '../auth.ts';

const router = express.Router();

// POST /api/v1/auth/login - { username, password } -> session token (also set as an HttpOnly cookie)
router.post('/login', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  if (isLockedOut(username)) {
    return res.status(429).json({ error: 'Too many failed sign-in attempts. Try again in 15 minutes.' });
  }

  const user = findUser(username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    recordLoginFailure(username);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  clearLoginFailures(username);
  const token = issueToken(user);
  res.setHeader('Set-Cookie', sessionCookie(token));
  return res.json({ token, user: { username: user.username, role: user.role } });
});

// POST /api/v1/auth/logout
router.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearedSessionCookie());
  return res.json({ status: 'success' });
});

// Everything below needs a valid session.
router.use(requireAuth);

// GET /api/v1/auth/me
router.get('/me', (req, res) => {
  return res.json(req.user);
});

// POST /api/v1/auth/password - { currentPassword, newPassword }; revokes earlier sessions
router.post('/password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = findUser(req.user!.username)!;
  if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  try {
    setPassword(user.username, newPassword);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  const token = issueToken(findUser(user.username)!);
  res.setHeader('Set-Cookie', sessionCookie(token));
  return res.json({ status: 'success', token });
});

// --- User administration (ADMIN only, including the list) ---

router.get('/users', (req, res) => {
  if (req.user!.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrator role required.' });
  }
  return res.json(listUsers());
});

router.post('/users', requireAdminForWrites, (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    createUser(username, password, role);
    return res.status(201).json({ status: 'success', username: String(username).trim(), role });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/users/:username', requireAdminForWrites, (req, res) => {
  if (req.params.username === req.user!.username) {
    return res.status(400).json({ error: 'You cannot delete the account you are signed in with.' });
  }
  try {
    deleteUser(req.params.username);
    return res.json({ status: 'success' });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
