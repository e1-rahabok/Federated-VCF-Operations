import express from 'express';

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (password === 'invalid') {
    return res.status(401).json({ error: 'Invalid credentials or session expired' });
  }
  return res.json({ token: 'demo_jwt_token_123', user: { username: username || 'admin', role: 'ADMIN' } });
});

// GET /api/v1/auth/me
router.get('/me', (req, res) => {
  return res.json({ username: 'admin', role: 'ADMIN' });
});

export default router;
