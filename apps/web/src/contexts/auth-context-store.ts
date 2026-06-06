import { createContext } from 'react';

import type { AuthUser } from '@nossoradar/shared';

export interface AuthContextValue {
  /** true enquanto há token e o /api/me está sendo resolvido na carga inicial. */
  loading: boolean;
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Persiste o token (vindo do callback OAuth) e carrega o usuário. */
  login: (token: string) => Promise<void>;
  /** Limpa o token e o usuário (encerra a sessão). */
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
