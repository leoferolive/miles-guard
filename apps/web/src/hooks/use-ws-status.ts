import { useEffect, useState } from 'react';

import { wsClient, type WsStatus } from '@/services/ws-client';

/** Estado da conexão WebSocket browser↔Painel (para indicadores de UI). */
export function useWsStatus(): WsStatus {
  const [status, setStatus] = useState<WsStatus>(() => wsClient.getStatus());
  useEffect(() => wsClient.onStatus(setStatus), []);
  return status;
}
