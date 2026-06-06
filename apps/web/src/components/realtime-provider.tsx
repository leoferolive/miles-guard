import { useEffect } from 'react';

import { useAuth } from '@/contexts/use-auth';
import { wsClient } from '@/services/ws-client';

/**
 * Mantém a conexão WebSocket viva enquanto houver sessão autenticada.
 * Conecta quando há token; desconecta no logout/expiração.
 */
export const RealtimeProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (token && isAuthenticated) {
      wsClient.connect(token);
      return () => wsClient.disconnect();
    }
    wsClient.disconnect();
  }, [token, isAuthenticated]);

  return <>{children}</>;
};
