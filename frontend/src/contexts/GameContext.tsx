import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const API = '';

export type BoardState = 'live' | 'sandbox' | 'idle';
export type MoveClassification = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface MoveEntry {
  san: string;
  fen: string;
  eval: number;
  classification: MoveClassification;
  evalDelta: number;
  color: string;
}

export interface GameState {
  id: string;
  fen: string;
  moves: MoveEntry[];
  currentMoveIndex: number;
  result: string | null;
  gameOver: boolean;
  boardState: BoardState;
  sessionId: string | null;
  liveEval: number;
  engineThinking: boolean;
}

export interface ChatMessageEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: any[];
  streaming?: boolean;
}

interface GameContextType {
  game: GameState | null;
  chatMessages: ChatMessageEntry[];
  sendChat: (message: string) => void;
  createGame: () => Promise<string>;
  makeMove: (san: string, uci?: string) => Promise<void>;
  setBoardState: (state: BoardState, sandboxFen?: string) => void;
  connected: boolean;
  wsRef: React.MutableRefObject<WebSocket | null>;
}

const GameContext = createContext<GameContextType | null>(null);

function evalDeltaToColor(delta: number): string {
  const SCALE = 1.5;
  const loss = Math.max(0, -delta);
  const saturated = Math.tanh(loss / SCALE);
  const hue = 120 * (1 - saturated);
  return `hsl(${hue.toFixed(1)}, 85%, 45%)`;
}

function classifyMove(delta: number): MoveClassification {
  const loss = Math.max(0, -delta);
  if (loss < 0.1) return 'best';
  if (loss < 0.3) return 'good';
  if (loss < 0.5) return 'inaccuracy';
  if (loss < 1.0) return 'mistake';
  return 'blunder';
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [game, setGame] = useState<GameState | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamingIdRef = useRef<string | null>(null);

  const connectWs = useCallback((gameId: string, sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/chat?gameId=${gameId}&sessionId=${sessionId}&userId=${user?.id}`
    );
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case 'token': {
          const streamId = streamingIdRef.current;
          if (!streamId) {
            const id = Date.now().toString();
            streamingIdRef.current = id;
            setChatMessages(prev => [...prev, { id, role: 'assistant', content: msg.data, streaming: true }]);
          } else {
            setChatMessages(prev => prev.map(m =>
              m.id === streamId ? { ...m, content: m.content + msg.data } : m
            ));
          }
          break;
        }
        case 'done': {
          const streamId = streamingIdRef.current;
          setChatMessages(prev => prev.map(m =>
            m.id === streamId ? { ...m, streaming: false, toolCalls: msg.data.toolCalls } : m
          ));
          streamingIdRef.current = null;
          break;
        }
        case 'tool_call': {
          const id = `tool-${Date.now()}`;
          setChatMessages(prev => [...prev, {
            id, role: 'assistant', content: `🔧 Calling ${msg.data.name}...`, streaming: true,
          }]);
          streamingIdRef.current = id;
          break;
        }
        case 'board_action': {
          setGame(prev => prev ? { ...prev, boardState: 'sandbox' } : prev);
          break;
        }
        case 'error': {
          setChatMessages(prev => [...prev, {
            id: Date.now().toString(), role: 'assistant',
            content: `⚠️ Error: ${msg.data}`,
          }]);
          break;
        }
      }
    };
  }, [user]);

  const createGame = useCallback(async () => {
    if (!user) throw new Error('Not logged in');
    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    const data = await res.json();
    const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    setGame({
      id: data.game.id,
      fen: INITIAL_FEN,
      moves: [],
      currentMoveIndex: -1,
      result: null,
      gameOver: false,
      boardState: 'live',
      sessionId: data.session.id,
      liveEval: 0,
      engineThinking: false,
    });
    setChatMessages([]);
    connectWs(data.game.id, data.session.id);
    return data.game.id;
  }, [user, connectWs]);

  const makeMove = useCallback(async (san: string, uci?: string) => {
    if (!game || game.gameOver || game.engineThinking) return;
    
    // Optimistically update FEN so the board doesn't snap back
    let optimisticFen = game.fen;
    try {
      const { Chess } = await import('chess.js');
      const chess = new Chess(game.fen);
      chess.move(san);
      optimisticFen = chess.fen();
    } catch (e) {
      // fallback
    }
    
    setGame(prev => prev ? { ...prev, engineThinking: true, fen: optimisticFen } : prev);
    try {
      const res = await fetch(`/api/games/${game.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moveSan: san, moveUci: uci, playerColor: 'white' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const newMoves = data.moves.map((moveSan: string, i: number) => {
        const evalVal = data.evals[i] ?? 0;
        const prevEval = i > 0 ? data.evals[i - 1] ?? 0 : 0;
        const delta = evalVal - prevEval;
        return {
          san: moveSan,
          fen: data.fens[i + 1] ?? '',
          eval: evalVal,
          classification: classifyMove(delta),
          evalDelta: delta,
          color: evalDeltaToColor(delta),
        };
      });

      setGame(prev => prev ? {
        ...prev,
        fen: data.currentFen,
        moves: newMoves,
        currentMoveIndex: newMoves.length - 1,
        result: data.result,
        gameOver: data.gameOver,
        liveEval: data.evals[data.evals.length - 1] ?? 0,
        engineThinking: false,
      } : prev);
    } catch (err) {
      console.error('Move error:', err);
      setGame(prev => prev ? { ...prev, engineThinking: false } : prev);
    }
  }, [game]);

  const sendChat = useCallback((message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: message }]);
    wsRef.current.send(JSON.stringify({ type: 'chat', content: message }));
  }, []);

  const setBoardState = useCallback((state: BoardState, sandboxFen?: string) => {
    setGame(prev => prev ? { ...prev, boardState: state } : prev);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'set_board_state', boardState: state, sandboxFen }));
    }
  }, []);

  return (
    <GameContext.Provider value={{ game, chatMessages, sendChat, createGame, makeMove, setBoardState, connected, wsRef }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
