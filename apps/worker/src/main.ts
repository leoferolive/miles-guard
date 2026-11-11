import { closeDb, listen } from '@nossoradar/db';
import { NOTIFY_CHANNELS } from '@nossoradar/shared';

import { backfillOfferExtraction } from './backfill.js';
import { env } from './env.js';
import { startHealthServer } from './health-server.js';
import { WhatsAppWorker } from './whatsapp.js';

/** Worker WhatsApp (singleton — ADR-0004). */
async function main(): Promise<void> {
  console.log('[worker] nossoRadar worker iniciando...');

  // Sobe primeiro o health/metrics: as probes do k8s precisam de /healthz
  // mesmo enquanto o pareamento WhatsApp ainda não concluiu.
  const healthServer = startHealthServer(env.WORKER_HEALTH_PORT);

  const worker = new WhatsAppWorker();
  await worker.reloadConfig();

  // Barramento web → worker (ADR-0003)
  await listen(NOTIFY_CHANNELS.configChanged, () => {
    console.log('[worker] config_changed recebido — recarregando.');
    void worker.reloadConfig();
  });
  await listen(NOTIFY_CHANNELS.refreshGroups, () => {
    console.log('[worker] refresh_groups recebido.');
    void worker.refreshGroups();
  });
  await listen(NOTIFY_CHANNELS.reconnectRequested, () => {
    console.log('[worker] reconnect_requested');
    void worker.requestReconnect();
  });

  await worker.connect();

  // Histórico de preço: extrai preço/produto das detecções antigas (em segundo plano;
  // não bloqueia a conexão nem os alertas).
  void backfillOfferExtraction()
    .then((n) => {
      if (n > 0) console.log(`[worker] histórico de preço: ${n} detecção(ões) reprocessada(s).`);
    })
    .catch((err: unknown) => console.error('[worker] backfill do histórico de preço falhou:', err));

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[worker] encerrando...');
    worker.stop();
    healthServer.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err: unknown) => {
  console.error('[worker] erro fatal:', err);
  process.exit(1);
});
