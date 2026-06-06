import { createContext } from 'react';

import type { AuthUser } from '@nossoradar/shared';

export interface AuthContextValue {
  /** true enquanto há token e o /api/me está sendo resolvido na carga inicial. */
  loading: boolean;
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /**
   * Login do dono (ADR-0007): autentica com e-mail + senha, persiste o token e
   * carrega o usuário. Lança erro (ApiError) em credenciais inválidas (401).
   */
  login: (email: string, password: string) => Promise<void>;
  /** Limpa o token e o usuário (encerra a sessão). */
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
