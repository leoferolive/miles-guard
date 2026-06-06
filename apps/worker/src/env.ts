import 'dotenv/config';

// DATABASE_URL é lido e validado pelo pacote @nossoradar/db (client.ts), não aqui.
export const env = {
  WA_SESSION_PATH: process.env.WA_SESSION_PATH ?? './.session',
  WA_RECONNECT_DELAY: Number(process.env.WA_RECONNECT_DELAY ?? 5000),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
  // Porta do servidor de health/metrics (probes k8s + scrape do ServiceMonitor).
  WORKER_HEALTH_PORT: Number(process.env.WORKER_HEALTH_PORT ?? 3001),
} as const;
