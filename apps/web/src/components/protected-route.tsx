import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuth } from '@/contexts/use-auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Guarda de rota: sem token/usuário → redireciona ao login. Enquanto o /api/me
 * inicial resolve, exibe um spinner para não piscar o login (token persistido).
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, loading, token } = useAuth();

  if (loading && token) {
    return (
      <div className="center-screen">
        <div className="spinner" aria-hidden="true" />
        <p>Carregando…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
