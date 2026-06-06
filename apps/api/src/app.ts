import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyRequest,
} from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';

import { env } from './env.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { oauthPlugin } from './plugins/oauth.plugin.js';
import { staticPlugin } from './plugins/static.plugin.js';
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
/** Redige `?token=` (o JWT do handshake WS) para não cair em access log. */
function redactToken(url: string): string {
  return url.replace(/([?&]token=)[^&]*/gi, '$1[REDACTED]');
}

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger:
      env.NODE_ENV !== 'test'
        ? {
            serializers: {
              // O JWT do WS chega como ?token= na URL; redige antes de logar.
              req(request: FastifyRequest) {
                return {
                  method: request.method,
                  url: redactToken(request.url),
                  host: request.headers.host ?? '',
                  remoteAddress: request.ip,
                };
              },
            },
          }
        : false,
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Erros de validação (zod, via schema: ou via .parse() manual) viram 400; o resto 500.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError || hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({ message: 'Requisição inválida.' });
    }
    // Respeita statusCode explícito (ex.: 401 do JWT) sem virar 500.
    const status = error.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'erro inesperado');
      return reply.code(500).send({ message: 'Erro interno.' });
    }
    return reply.code(status).send({ message: error.message });
  });

  // Security headers + CSP real: o Painel agora serve a SPA (Fase 4), então
  // restringimos as fontes ao próprio host. A política é compatível com o bundle
  // do Vite (script/style externos hasheados); o WS precisa de ws:/wss: em connect-src
  // e o avatar do Google em img-src.
  void app.register(import('@fastify/helmet'), {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'img-src': ["'self'", 'data:', 'https://*.googleusercontent.com'],
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'font-src': ["'self'", 'data:'],
        'object-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  // Rate limiting global (desabilitado em testes). Cobre callback de auth e upgrade do WS.
  if (env.NODE_ENV !== 'test') {
    void app.register(import('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      allowList: (req) => req.url === '/healthz',
    });
  }

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

  // SPA estática (Fase 4): serve apps/web/dist com history fallback.
  // No-op se o dist não existir (dev/test) — não quebra a API.
  void app.register(staticPlugin);

  return app;
}
