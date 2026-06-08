import 'dotenv/config';

// DATABASE_URL é lido e validado pelo pacote @nossoradar/db (client.ts), não aqui.
export const env = {
  WA_SESSION_PATH: process.env.WA_SESSION_PATH ?? './.session',
  WA_RECONNECT_DELAY: Number(process.env.WA_RECONNECT_DELAY ?? 5000),
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
  // Porta do servidor de health/metrics (probes k8s + scrape do ServiceMonitor).
  WORKER_HEALTH_PORT: Number(process.env.WORKER_HEALTH_PORT ?? 3001),
  // Nível de log: 'debug' habilita logs por-mensagem de baixo volume (no_match/dedup);
  // 'info' (padrão) mantém só detecções e o WARN de no_text (formato não mapeado).
  LOG_LEVEL: (process.env.LOG_LEVEL ?? 'info').toLowerCase(),
} as const;
