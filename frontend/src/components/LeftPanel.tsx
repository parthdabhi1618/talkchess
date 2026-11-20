import React from 'react';
import { useGame } from '../contexts/GameContext';

export default function LeftPanel() {
  const { game } = useGame();

  return (
    <div style={{ width: '220px', background: '#1e1e1e', borderRight: '1px solid #3a3a3a', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #2d2d2d' }}>
        <h3 style={{ fontSize: '13px', color: '#9a9a9a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Analysis</h3>
      </div>
      {game && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: '#242424', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '11px', color: '#9a9a9a', marginBottom: '4px' }}>Evaluation</div>
            <div style={{ fontSize: '20px', fontFamily: 'monospace', fontWeight: 700, color: game.liveEval >= 0 ? '#e8e8e8' : '#1a1a1a', textShadow: game.liveEval >= 0 ? 'none' : '0 0 8px #fff' }}>
              {game.liveEval >= 0 ? `+${game.liveEval.toFixed(2)}` : game.liveEval.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', color: game.liveEval >= 0 ? '#4caf50' : '#f44336', marginTop: '2px' }}>
              {game.liveEval >= 0 ? 'White is better' : 'Black is better'}
            </div>
          </div>
          <div style={{ background: '#242424', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontSize: '11px', color: '#9a9a9a', marginBottom: '4px' }}>Moves played</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{game.moves.length}</div>
          </div>
          {game.gameOver && (
            <div style={{ background: '#2d2d1a', borderRadius: '6px', padding: '10px', border: '1px solid #ff9800' }}>
              <div style={{ fontSize: '11px', color: '#ff9800', marginBottom: '4px' }}>Game Result</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{game.result}</div>
            </div>
          )}
        </div>
      )}
      {/* Placeholder for openings/puzzles panels (post-MVP) */}
      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px', borderTop: '1px solid #2d2d2d', color: '#555', fontSize: '11px' }}>
        Openings · Puzzles (post-MVP)
      </div>
    </div>
  );
}
