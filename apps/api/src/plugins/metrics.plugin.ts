import { Counter, Registry, collectDefaultMetrics } from 'prom-client';
import fp from 'fastify-plugin';

/**
 * Observabilidade do Painel (Fase 6 / plano). Substitui o `/metrics` stub por um
 * registro Prometheus real: métricas padrão de processo + um contador de
 * requests HTTP rotulado por método/rota/status.
 *
 * Scrape pelo ServiceMonitor (label `release: kps`). O `/healthz` permanece
 * em app.ts (probes do k8s).
 */
export const metricsPlugin = fp(async (fastify) => {
  const registry = new Registry();
  registry.setDefaultLabels({ app: 'nossoradar-web' });
  collectDefaultMetrics({ register: registry, prefix: 'nossoradar_web_' });

  const httpRequests = new Counter({
    name: 'nossoradar_web_http_requests_total',
    help: 'Total de requests HTTP atendidos pelo Painel.',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [registry],
  });

  // Conta cada resposta. `routeOptions.url` é o template da rota (ex.: /api/groups/:id),
  // evitando explosão de cardinalidade por ids no path. Métricas próprias não contam.
  fastify.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url ?? 'unknown';
    if (route === '/metrics') return;
    httpRequests.inc({
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    });
  });

  fastify.get('/metrics', async (_req, reply) => {
    reply.type(registry.contentType);
    return registry.metrics();
  });
});
