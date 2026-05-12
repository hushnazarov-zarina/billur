"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken as saveToken } from '@/lib/api/client';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role_id: string;
  permissions: string[];
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (!token) { setLoading(false); return; }
      try {
        const me = await api.get<User>('/api/auth/me');
        setUser(me);
      } catch {
        saveToken(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/login', {
      username, password,
    });
    saveToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    saveToken(null);
    setUser(null);
  };

  const hasPermission = (perm: string) => !!user?.permissions.includes(perm);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
