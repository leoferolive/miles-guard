import { createServer, type Server } from 'node:http';

import { registry } from './metrics.js';

/**
 * Servidor HTTP mínimo e não-bloqueante do Worker (o worker não tem API).
 *
 * Expõe apenas o que as probes/observabilidade do k8s precisam:
 *   - `GET /healthz`  → 200 (liveness/readiness do Deployment).
 *   - `GET /metrics`  → texto Prometheus (scrape do ServiceMonitor).
 *
 * Tudo o mais responde 404. Sem dependência de framework para manter o
 * processo singleton leve no Raspberry Pi (ARM).
 */
export function startHealthServer(port: number): Server {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';

    if (req.method === 'GET' && (url === '/healthz' || url === '/healthz/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'GET' && (url === '/metrics' || url === '/metrics/')) {
      registry
        .metrics()
        .then((body) => {
          res.writeHead(200, { 'content-type': registry.contentType });
          res.end(body);
        })
        .catch((err: unknown) => {
          console.error('[worker] erro ao coletar métricas:', err);
          res.writeHead(500, { 'content-type': 'text/plain' });
          res.end('# erro ao coletar métricas\n');
        });
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Não encontrado.' }));
  });

  // unref(): o servidor de health não deve, sozinho, manter o processo vivo
  // no shutdown — o ciclo de vida é ditado pelo worker WhatsApp.
  server.listen(port, '0.0.0.0', () => {
    console.log(`[worker] health/metrics em http://0.0.0.0:${port} (/healthz, /metrics)`);
  });
  server.unref();

  return server;
}
