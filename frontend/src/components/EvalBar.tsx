import React from 'react';

interface EvalBarProps {
  eval: number; // in pawns, from white's perspective
  height?: number;
}

export default function EvalBar({ eval: evalScore, height = 400 }: EvalBarProps) {
  // Clamp eval to [-10, 10] for display
  const clamped = Math.max(-10, Math.min(10, evalScore));
  // White's percentage: 50% at 0, approaching 100% at +10, 0% at -10
  const whitePercent = 50 + (Math.tanh(clamped / 4) * 50);
  const blackPercent = 100 - whitePercent;

  const evalDisplay = Math.abs(evalScore) >= 9.5
    ? (evalScore > 0 ? '+M' : '-M')
    : (evalScore > 0 ? `+${evalScore.toFixed(1)}` : evalScore.toFixed(1));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '28px', height: `${height}px`, flexShrink: 0 }}>
      {/* Black side */}
      <div style={{
        width: '100%', flex: 1, display: 'flex', flexDirection: 'column',
        borderRadius: '4px 4px 0 0', overflow: 'hidden',
        border: '1px solid #3a3a3a',
      }}>
        <div style={{ width: '100%', height: `${blackPercent}%`, background: '#1a1a1a', transition: 'height 0.4s ease' }} />
        <div style={{ width: '100%', height: `${whitePercent}%`, background: '#e8e8e8', transition: 'height 0.4s ease' }} />
      </div>
      {/* Eval text */}
      <div style={{ fontSize: '10px', color: '#9a9a9a', marginTop: '4px', fontFamily: 'monospace' }}>
        {evalDisplay}
      </div>
    </div>
  );
}
