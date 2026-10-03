import { CONFIG } from '../config.ts';

export default function authRoutes(req: any, res: any, next: any) {
  const { username, password } = req.body || {};

  if (req.method === 'POST') {
    if (password === 'invalid') {
      return res.status(401).json({ error: 'Invalid credentials or session expired' });
    }
    return res.json({ token: 'demo_jwt_token_123', user: { username: username || 'admin', role: 'ADMIN' } });
  }

  return res.json({ username: 'admin', role: 'ADMIN' });
}
