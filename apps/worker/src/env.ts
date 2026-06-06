import 'dotenv/config';

// DATABASE_URL é lido e validado pelo pacote @nossoradar/db (client.ts), não aqui.
export const env = {
  WA_SESSION_PATH: process.env.WA_SESSION_PATH ?? './.session',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
} as const;
