import Fastify from 'fastify';

import { env } from './env.js';

const app = Fastify({ logger: true });

app.get('/healthz', async () => ({ status: 'ok' }));

// Placeholder de métricas (Fase 6: Prometheus + ServiceMonitor)
app.get('/metrics', async (_req, reply) => {
  reply.type('text/plain');
  return '# nossoRadar metrics (stub)\n';
});

/**
 * Fase 4+ (a implementar):
 *  - GET /api/auth/google + callback (allowlist ALLOWED_EMAILS) + JWT;
 *  - CRUD de Grupos Monitorados e Palavras-chave (NOTIFY config_changed);
 *  - GET detecções / stats;
 *  - WebSocket: QR/status/feed via LISTEN no Postgres;
 *  - servir o SPA React buildado.
 */
async function start(): Promise<void> {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
