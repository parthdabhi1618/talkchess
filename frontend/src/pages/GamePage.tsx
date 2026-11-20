import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useGame } from '../contexts/GameContext';
import BoardArea from '../components/BoardArea';
import LeftPanel from '../components/LeftPanel';
import RightPanel from '../components/RightPanel';
import TopBar from '../components/TopBar';

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const { createGame, game } = useGame();

  useEffect(() => {
    if (!game && id) {
      createGame().catch(console.error);
    }
  }, []);

  if (!game) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#9a9a9a' }}>Loading game...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftPanel />
        <BoardArea />
        <RightPanel />
      </div>
    </div>
  );
}
