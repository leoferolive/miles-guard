import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { env } from './env.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { oauthPlugin } from './plugins/oauth.plugin.js';
import { websocketPlugin } from './plugins/websocket.plugin.js';
import { authRoutes } from './routes/auth.routes.js';
import { connectionRoutes } from './routes/connection.routes.js';
import { detectionsRoutes } from './routes/detections.routes.js';
import { groupsRoutes } from './routes/groups.routes.js';
import { whatsappRoutes } from './routes/whatsapp.routes.js';
import { wsRoutes } from './routes/ws.routes.js';

/**
 * Factory do Painel (API + WebSocket + OAuth). Exportada para os testes injetarem via
 * `app.inject()` sem subir um servidor real. Fase 4 servirá o SPA estático aqui.
 */
export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  void app.register(import('@fastify/cors'), {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  void app.register(authPlugin);
  void app.register(oauthPlugin);
  void app.register(websocketPlugin);

  // Healthcheck (probes k8s) e métricas stub (Fase 6).
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/metrics', async (_req, reply) => {
    reply.type('text/plain');
    return '# nossoRadar metrics (stub)\n';
  });

  // API REST + WS sob /api e /ws.
  void app.register(authRoutes, { prefix: '/api' });
  void app.register(connectionRoutes, { prefix: '/api' });
  void app.register(groupsRoutes, { prefix: '/api' });
  void app.register(whatsappRoutes, { prefix: '/api' });
  void app.register(detectionsRoutes, { prefix: '/api' });
  void app.register(wsRoutes);

  return app;
}
