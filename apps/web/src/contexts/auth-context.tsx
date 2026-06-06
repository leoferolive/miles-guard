import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AuthUser } from '@nossoradar/shared';

import { radarService } from '@/services/radar.service';
import { clearStoredToken, getStoredToken, setStoredToken } from '@/services/token-storage';

import { AuthContext, type AuthContextValue } from './auth-context-store';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  // Só ficamos "carregando" se havia token persistido a resolver na partida.
  const [loading, setLoading] = useState<boolean>(() => getStoredToken() !== null);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const login = useCallback(async (nextToken: string) => {
    setStoredToken(nextToken);
    setToken(nextToken);
    setLoading(true);
    try {
      const me = await radarService.me();
      setUser(me);
    } catch {
      // Token inválido/expirado: encerra a sessão.
      clearStoredToken();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Na carga inicial, se há token mas ainda não há usuário, resolve /api/me.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return;
    }
    if (user) return;

    setLoading(true);
    radarService
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) {
          clearStoredToken();
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      token,
      user,
      isAuthenticated: token !== null && user !== null,
      login,
      logout,
    }),
    [loading, token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
