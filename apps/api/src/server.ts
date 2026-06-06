import { closeDb } from '@nossoradar/db';

import { buildApp } from './app.js';
import { env } from './env.js';

const app = buildApp();

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`recebido ${signal}, encerrando...`);
  try {
    // app.close() roda os onClose dos plugins (ex.: unlisten do websocket.plugin)...
    await app.close();
    // ...e só então fechamos o pool do Postgres.
    await closeDb();
  } catch (err) {
    app.log.error(err);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

async function start(): Promise<void> {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void start();
