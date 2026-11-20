import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { DEMO_MODE } from '../config';

const API = '';

interface User { id: string; username: string; }
interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
  token: string | null;
  ready: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('tc_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tc_token'));
  // In demo mode auth is resolved asynchronously on mount; wait for it before routing.
  const [ready, setReady] = useState(!DEMO_MODE);

  const saveSession = useCallback((nextUser: User, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    localStorage.setItem('tc_user', JSON.stringify(nextUser));
    localStorage.setItem('tc_token', nextToken);
  }, []);

  useEffect(() => {
    if (!DEMO_MODE) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API}/api/auth/demo`, { method: 'POST' });
        if (!res.ok) throw new Error('Demo sign-in failed');
        const data = await res.json();
        if (!cancelled) saveSession(data.user, data.token);
      } catch (err) {
        console.error('Demo sign-in failed:', err);
        if (!cancelled) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('tc_user');
          localStorage.removeItem('tc_token');
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [saveSession]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Login failed');
    }
    const data = await res.json();
    saveSession(data.user, data.token);
  }, [saveSession]);

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? 'Registration failed');
    }
    await login(username, password);
  }, [login]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('tc_user');
    localStorage.removeItem('tc_token');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, token, ready, isDemo: DEMO_MODE }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
