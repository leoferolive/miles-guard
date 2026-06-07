import { closeDb, listen } from '@nossoradar/db';
import { NOTIFY_CHANNELS } from '@nossoradar/shared';

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
