import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface GameSummary {
  id: string;
  result: string | null;
  status: string;
  createdAt: string;
  moves: string;
  evals: string;
}

export default function HistoryPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/games?userId=${user.id}`)
      .then(r => r.json())
      .then(data => { setGames(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  const startNewGame = async () => {
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id }),
    });
    const data = await res.json();
    navigate(`/game/${data.game.id}?sessionId=${data.session.id}`);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px' }}>♟️ TalkChess</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ color: '#9a9a9a', fontSize: '14px' }}>@{user?.username}</span>
          <button onClick={() => navigate('/profile')} style={{ background: '#2d2d2d', fontSize: '13px', padding: '6px 12px' }}>Profile</button>
          <button onClick={logout} style={{ background: '#2d2d2d', fontSize: '13px', padding: '6px 12px' }}>Sign Out</button>
        </div>
      </div>

      <button onClick={startNewGame} style={{ width: '100%', padding: '16px', fontSize: '16px', marginBottom: '24px', background: '#4a9eff' }}>
        ♟️ New Game vs Stockfish
      </button>

      <h2 style={{ fontSize: '18px', marginBottom: '16px', color: '#9a9a9a' }}>Game History</h2>

      {loading ? <p style={{ color: '#666' }}>Loading...</p> : games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
          <p style={{ fontSize: '48px' }}>♟️</p>
          <p style={{ marginTop: '16px' }}>No games yet. Start your first game!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {games.map(g => {
            const moveCount = (() => { try { return JSON.parse(g.moves).length; } catch { return 0; } })();
            return (
              <div key={g.id}
                onClick={() => navigate(`/game/${g.id}`)}
                style={{ background: '#242424', border: '1px solid #3a3a3a', borderRadius: '8px', padding: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>
                    {g.result ?? (g.status === 'active' ? '● Active' : '—')}
                  </span>
                  <span style={{ marginLeft: '12px', color: '#9a9a9a', fontSize: '13px' }}>{moveCount} moves</span>
                </div>
                <span style={{ color: '#666', fontSize: '12px' }}>{new Date(g.createdAt).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
