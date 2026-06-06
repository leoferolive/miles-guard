import { useEffect, useRef } from 'react';

import { wsClient, type WsMessage } from '@/services/ws-client';

/**
 * Assina o barramento WebSocket. `channel` filtra (ou `undefined` p/ todos).
 * O callback é mantido por ref para não re-assinar a cada render.
 */
export function useRealtime(
  handler: (msg: WsMessage) => void,
  channel?: string,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return wsClient.onMessage((msg) => {
      if (channel && msg.channel !== channel) return;
      handlerRef.current(msg);
    });
  }, [channel]);
}
