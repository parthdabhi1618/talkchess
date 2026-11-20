import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { DEMO_MODE } from '../config';

export default function TopBar() {
  const { logout, user } = useAuth();
  const { game, connected } = useGame();
  const navigate = useNavigate();

  const boardStateLabel: Record<string, string> = {
    live: '● Live Game',
    sandbox: '◈ Analysis Sandbox',
    idle: '○ Idle',
  };

  return (
    <div style={{ height: '48px', background: '#242424', borderBottom: '1px solid #3a3a3a', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '16px', flexShrink: 0 }}>
      <span style={{ fontWeight: 700, fontSize: '16px' }}>♟️ TalkChess</span>
      {game && (
        <span style={{ fontSize: '13px', color: game.boardState === 'live' ? '#4caf50' : game.boardState === 'sandbox' ? '#9c27b0' : '#9a9a9a', marginLeft: '8px' }}>
          {boardStateLabel[game.boardState]}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: '12px', color: connected ? '#4caf50' : '#f44336' }}>
        {connected ? '● Coach Connected' : '○ Coach Disconnected'}
      </span>
      <span style={{ fontSize: '13px', color: '#9a9a9a' }}>@{user?.username}</span>
      {DEMO_MODE && <span style={{ fontSize: '11px', color: '#ffb74d', border: '1px solid #ffb74d', borderRadius: '4px', padding: '1px 6px' }}>Demo</span>}
      <button onClick={() => navigate('/history')} style={{ background: '#2d2d2d', fontSize: '12px', padding: '4px 10px' }}>Games</button>
      {!DEMO_MODE && <button onClick={logout} style={{ background: '#2d2d2d', fontSize: '12px', padding: '4px 10px' }}>Sign Out</button>}
    </div>
  );
}
