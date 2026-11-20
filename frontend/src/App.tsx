import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { DEMO_MODE } from './config';
import LoginPage from './pages/LoginPage';
import GamePage from './pages/GamePage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';

function LoadingScreen({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a1a' }}>
      <p style={{ color: '#9a9a9a' }}>{message}</p>
    </div>
  );
}

function DemoFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '12px', background: '#1a1a1a' }}>
      <h1 style={{ color: '#e0e0e0', fontSize: '20px' }}>Couldn't start demo mode</h1>
      <p style={{ color: '#9a9a9a', fontSize: '14px' }}>Make sure the backend is running, then try again.</p>
      <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#4a9eff' }}>Retry</button>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <LoadingScreen message={DEMO_MODE ? 'Starting demo...' : 'Loading...'} />;
  if (!user) return DEMO_MODE ? <DemoFallback /> : <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={DEMO_MODE ? <Navigate to="/play" replace /> : <LoginPage />} />
          <Route path="/play" element={
            <ProtectedRoute>
              <GameProvider>
                <GamePage />
              </GameProvider>
            </ProtectedRoute>
          } />
          <Route path="/game/:id" element={
            <ProtectedRoute>
              <GameProvider>
                <GamePage />
              </GameProvider>
            </ProtectedRoute>
          } />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/" element={
            <ProtectedRoute>
              <Navigate to={DEMO_MODE ? '/play' : '/history'} replace />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
