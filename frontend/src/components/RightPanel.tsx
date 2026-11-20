import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';

export default function RightPanel() {
  const { chatMessages, sendChat, connected, game } = useGame();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || !connected) return;
    sendChat(msg);
    setInput('');
  };

  return (
    <div style={{ width: '320px', background: '#1e1e1e', borderLeft: '1px solid #3a3a3a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d2d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600 }}>🤖 Coach</h3>
          <p style={{ fontSize: '11px', color: '#9a9a9a' }}>Powered by Stockfish + Ollama</p>
        </div>
        <span style={{ fontSize: '11px', color: connected ? '#4caf50' : '#f44336' }}>
          {connected ? '● Live' : '○ Off'}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {chatMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>💬</p>
            <p style={{ fontSize: '13px', lineHeight: '1.5' }}>Ask your coach about the position, a specific move, or request an analysis!</p>
            <p style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>e.g. "Why was my last move bad?" or "What's the best plan here?"</p>
          </div>
        )}
        {chatMessages.map(msg => (
          <div key={msg.id} style={{
            maxWidth: '100%',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              background: msg.role === 'user' ? '#1a3a5c' : '#2a2a2a',
              border: `1px solid ${msg.role === 'user' ? '#2d5a8a' : '#3a3a3a'}`,
              borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              padding: '10px 14px',
              fontSize: '13px',
              lineHeight: '1.5',
              color: msg.streaming ? '#9a9a9a' : '#e0e0e0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.content}
              {msg.streaming && <span style={{ animation: 'blink 1s infinite', marginLeft: '2px' }}>▋</span>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid #2d2d2d', display: 'flex', gap: '8px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={connected ? 'Ask your coach...' : 'Coach not connected'}
          disabled={!connected || !game}
          rows={2}
          style={{ flex: 1, resize: 'none', fontSize: '13px', lineHeight: '1.4' }}
        />
        <button onClick={handleSend} disabled={!connected || !input.trim() || !game}
          style={{ width: '40px', padding: '8px', fontSize: '16px', alignSelf: 'flex-end' }}>
          ↑
        </button>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
