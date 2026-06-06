import { closeDb, listen } from '@nossoradar/db';
import { NOTIFY_CHANNELS } from '@nossoradar/shared';

import { WhatsAppWorker } from './whatsapp.js';

/** Worker WhatsApp (singleton — ADR-0004). */
async function main(): Promise<void> {
  console.log('[worker] nossoRadar worker iniciando...');

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

  await worker.connect();

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[worker] encerrando...');
    worker.stop();
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
