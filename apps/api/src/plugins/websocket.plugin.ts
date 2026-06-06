import { listen } from '@nossoradar/db';
import { NOTIFY_CHANNELS } from '@nossoradar/shared';
import fp from 'fastify-plugin';

import { env } from '../env.js';
import { WsHub } from '../ws/ws-hub.js';

declare module 'fastify' {
  interface FastifyInstance {
    wsHub: WsHub;
  }
}

/**
 * Registra @fastify/websocket e o WsHub. No processo do Painel, mantém UMA assinatura
 * `listen()` por canal worker→web (ADR-0003) e faz broadcast a todos os clientes WS.
 * Canais: connection_state, detection_created, groups_refreshed.
 */
export const websocketPlugin = fp(async (fastify) => {
  await fastify.register(import('@fastify/websocket'));

  const hub = new WsHub();
  fastify.decorate('wsHub', hub);

  // Em testes não há Postgres real; pula a assinatura LISTEN.
  if (env.NODE_ENV === 'test') return;

  const channels = [
    NOTIFY_CHANNELS.connectionState,
    NOTIFY_CHANNELS.detectionCreated,
    NOTIFY_CHANNELS.groupsRefreshed,
  ] as const;

  const unlisteners: Array<() => Promise<void>> = [];
  try {
    for (const channel of channels) {
      const unlisten = await listen(channel, (payload) => {
        hub.broadcast(channel, payload);
      });
      unlisteners.push(unlisten);
    }
  } catch (err) {
    fastify.log.error({ err }, 'falha ao assinar canais LISTEN/NOTIFY');
  }

  fastify.addHook('onClose', async () => {
    await Promise.allSettled(unlisteners.map((u) => u()));
  });
});
