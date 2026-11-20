import React, { useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { useGame } from '../contexts/GameContext';
import EvalBar from './EvalBar';
import MoveList from './MoveList';

export default function BoardArea() {
  const { game, makeMove, setBoardState } = useGame();

  const onDrop = useCallback((sourceSquare: string, targetSquare: string, piece: string): boolean => {
    if (!game || game.gameOver || game.engineThinking) return false;
    if (game.boardState !== 'live') return false;

    const chess = new Chess(game.fen);
    if (chess.turn() !== 'w') return false; // User plays white

    const promotion = piece.toLowerCase().includes('p') &&
      ((targetSquare[1] === '8' && piece[0] === 'w') || (targetSquare[1] === '1' && piece[0] === 'b'))
      ? 'q' : undefined;

    try {
      const moveObj = chess.move({ from: sourceSquare, to: targetSquare, promotion });
      if (!moveObj) return false;
      const uci = sourceSquare + targetSquare + (promotion ?? '');
      makeMove(moveObj.san, uci);
      return true;
    } catch {
      return false;
    }
  }, [game, makeMove]);

  const boardStateStyle = {
    live: { boxShadow: '0 0 0 3px #3a3a3a' },
    sandbox: { boxShadow: '0 0 0 3px #9c27b0', filter: 'saturate(0.7) brightness(0.9)' },
    idle: { boxShadow: '0 0 0 3px #2a2a2a' },
  };

  if (!game) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#666' }}>Loading...</p>
    </div>;
  }

  const BOARD_SIZE = Math.min(window.innerHeight - 100, window.innerWidth - 600);
  const boardSize = Math.max(300, Math.min(BOARD_SIZE, 560));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', gap: '8px' }}>
      {/* Board + Eval Bar Row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <EvalBar eval={game.liveEval} height={boardSize} />
        <div style={{ ...boardStateStyle[game.boardState], borderRadius: '4px' }}>
          <Chessboard
            id="main-board"
            position={game.fen}
            onPieceDrop={onDrop}
            boardWidth={boardSize}
            arePiecesDraggable={!game.gameOver && !game.engineThinking && game.boardState === 'live'}
            customBoardStyle={{ borderRadius: '4px' }}
            customDarkSquareStyle={{ backgroundColor: '#769656' }}
            customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
          />
        </div>
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#9a9a9a', fontSize: '13px' }}>
        {game.engineThinking && <span style={{ color: '#4a9eff' }}>⟳ Engine thinking...</span>}
        {game.gameOver && <span style={{ color: '#ff9800', fontWeight: 600 }}>Game over: {game.result}</span>}
        {!game.engineThinking && !game.gameOver && (
          <span>{new Chess(game.fen).turn() === 'w' ? 'Your move (White)' : 'Engine thinking...'}</span>
        )}
      </div>

      {/* Sandbox toggle */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setBoardState(game.boardState === 'sandbox' ? 'live' : 'sandbox', game.fen)}
          style={{ background: game.boardState === 'sandbox' ? '#9c27b0' : '#2d2d2d', fontSize: '12px', padding: '4px 10px' }}
        >
          {game.boardState === 'sandbox' ? '◈ Exit Sandbox' : '◈ Analysis Sandbox'}
        </button>
      </div>

      {/* Move list below board */}
      <div style={{ width: `${boardSize}px`, maxHeight: '120px', background: '#242424', borderRadius: '6px', overflow: 'hidden', border: '1px solid #3a3a3a' }}>
        <MoveList moves={game.moves} currentIndex={game.currentMoveIndex} />
      </div>
    </div>
  );
}
