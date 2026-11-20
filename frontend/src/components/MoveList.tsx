import React from 'react';
import { MoveEntry, MoveClassification } from '../contexts/GameContext';

interface MoveListProps {
  moves: MoveEntry[];
  currentIndex: number;
  onSelectMove?: (index: number) => void;
}

const SYMBOLS: Record<MoveClassification, string> = {
  best: '!', good: '', inaccuracy: '?!', mistake: '?', blunder: '??'
};

export default function MoveList({ moves, currentIndex, onSelectMove }: MoveListProps) {
  const pairs: Array<[MoveEntry | null, MoveEntry | null, number]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i] ?? null, moves[i + 1] ?? null, i]);
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
      {pairs.length === 0 ? (
        <p style={{ color: '#666', fontSize: '13px', textAlign: 'center', padding: '16px' }}>Make a move to begin</p>
      ) : (
        pairs.map(([white, black, startIdx]) => (
          <div key={startIdx} style={{ display: 'flex', gap: '4px', marginBottom: '2px', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '12px', width: '24px', textAlign: 'right', flexShrink: 0 }}>
              {Math.floor(startIdx / 2) + 1}.
            </span>
            {[white, black].map((move, j) => {
              if (!move) return <div key={j} style={{ flex: 1 }} />;
              const idx = startIdx + j;
              const isActive = idx === currentIndex;
              return (
                <button key={j}
                  onClick={() => onSelectMove?.(idx)}
                  style={{
                    flex: 1, padding: '4px 6px', borderRadius: '4px', fontSize: '13px',
                    fontFamily: 'monospace', textAlign: 'left',
                    background: isActive ? '#3a3a3a' : 'transparent',
                    color: move.color,
                    border: isActive ? `1px solid ${move.color}` : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                >
                  {move.san}{SYMBOLS[move.classification]}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
