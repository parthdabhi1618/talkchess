import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
      navigate('/history');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a' }}>
      <div style={{ background: '#242424', padding: '40px', borderRadius: '12px', width: '360px', border: '1px solid #3a3a3a' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '28px' }}>♟️ TalkChess</h1>
        <p style={{ textAlign: 'center', color: '#9a9a9a', marginBottom: '32px', fontSize: '14px' }}>Chess coaching powered by Stockfish + AI</p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {(['login', 'register'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, background: mode === m ? '#4a9eff' : '#2d2d2d', color: 'white' }}>
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="text" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} required
            style={{ width: '100%' }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required
            style={{ width: '100%' }}
          />
          {error && <p style={{ color: '#f44336', fontSize: '13px' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
