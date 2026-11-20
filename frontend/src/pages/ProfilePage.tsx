import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Stats {
  bestMoves: number;
  goodMoves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/stats?userId=${user.id}`)
      .then(r => r.json())
      .then(setStats)
      .catch(() => setStats({ bestMoves: 0, goodMoves: 0, inaccuracies: 0, mistakes: 0, blunders: 0 }));
  }, [user]);

  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0;

  const statItems = stats ? [
    { label: 'Best Moves', value: stats.bestMoves, color: '#4caf50', symbol: '!' },
    { label: 'Good Moves', value: stats.goodMoves, color: '#8bc34a', symbol: '✓' },
    { label: 'Inaccuracies', value: stats.inaccuracies, color: '#ff9800', symbol: '?!' },
    { label: 'Mistakes', value: stats.mistakes, color: '#ff5722', symbol: '?' },
    { label: 'Blunders', value: stats.blunders, color: '#f44336', symbol: '??' },
  ] : [];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        <button onClick={() => navigate('/history')} style={{ background: '#2d2d2d', padding: '8px 16px' }}>← Back</button>
        <h1 style={{ fontSize: '24px' }}>Profile</h1>
      </div>

      <div style={{ background: '#242424', border: '1px solid #3a3a3a', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '4px' }}>@{user?.username}</h2>
        <p style={{ color: '#9a9a9a', fontSize: '14px' }}>{total} moves analyzed</p>
      </div>

      <h3 style={{ fontSize: '16px', marginBottom: '16px', color: '#9a9a9a' }}>Move Quality Breakdown</h3>

      {statItems.map(s => (
        <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #2d2d2d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: s.color, fontWeight: 700, width: '24px', textAlign: 'center' }}>{s.symbol}</span>
            <span style={{ fontSize: '14px' }}>{s.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '120px', height: '6px', background: '#2d2d2d', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${total > 0 ? (s.value / total) * 100 : 0}%`, height: '100%', background: s.color, borderRadius: '3px', transition: 'width 0.5s' }} />
            </div>
            <span style={{ color: '#9a9a9a', fontSize: '14px', width: '40px', textAlign: 'right' }}>{s.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
