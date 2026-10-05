import React, { useState } from 'react';
import { apiPost, setAuthToken, type SessionUser } from '../api';

interface LoginPageProps {
  onLoginSuccess: (user: SessionUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await apiPost<{ token: string; user: SessionUser }>('/auth/login', { username, password });
      setAuthToken(data.token);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a' }}>
      <div className="panel" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ fontSize: '36px' }}>🌐</span>
          <h2 style={{ color: '#f8fafc', marginTop: '12px', fontSize: '20px' }}>Federated VCF Operations</h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Sign in to your central portal</p>
        </div>

        {error && (
          <div data-testid="login-error" style={{ background: '#7f1d1d', color: '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="login-username" style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              style={{ width: '100%' }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              style={{ width: '100%' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
