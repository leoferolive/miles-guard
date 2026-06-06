import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';

/**
 * GET /ws — canal de push para o browser. Autentica via `?token=` (browsers não enviam
 * headers no handshake WS). O processo do Painel já mantém os LISTEN do Postgres (ver
 * websocket.plugin.ts) e faz broadcast `{ channel, payload }` a todos os clientes aqui registrados.
 */
export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket: WebSocket, request) => {
    const query = request.query as Record<string, string | undefined>;
    const token = query.token;

    if (!token) {
      socket.close(4001, 'Token ausente');
      return;
    }

    try {
      fastify.jwt.verify(token);
    } catch {
      socket.close(4001, 'Token inválido ou expirado');
      return;
    }

    fastify.wsHub.add(socket);
    socket.on('close', () => fastify.wsHub.remove(socket));
  });
};
