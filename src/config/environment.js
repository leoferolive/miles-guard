const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WA_SESSION_PATH: z.string().default('./sessions'),
  WA_RECONNECT_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  WA_RECONNECT_DELAY: z.coerce.number().int().min(1000).max(60000).default(5000),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('./logs/milesguard.log'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_RATE_LIMIT: z.coerce.number().int().min(1).max(60).default(30),
  DEBUG_MODE: z.coerce.boolean().default(false)
});

module.exports = envSchema.parse(process.env);