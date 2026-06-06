import { config } from 'dotenv';
import { z } from 'zod';

config();

const INSECURE_JWT_DEFAULT = 'dev-inseguro-troque-por-32+-caracteres-aleatorios';

/**
 * Hash bcrypt da senha de dev (texto: `dev`) — APENAS para subir o app em dev/test
 * sem precisar gerar um hash. Em produção é proibido (fail-fast no superRefine).
 * Gerado com: bcryptjs.hashSync('dev', 10).
 */
const DEV_PASSWORD_HASH = '$2a$10$so4f68IybCBgMr4kI4R92OHh1qzPqMqAdtrNf4MJUWNOUOidQ2n62';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Schema do ambiente do Painel. Fora de produção há defaults seguros para dev/test;
 * em produção (NODE_ENV==='production') exigimos segredos reais (fail-fast).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    PUBLIC_URL: z.string().url().default('http://localhost:3000'),
    /** Origem do SPA para CORS (Fase 4); por padrão o próprio Painel. */
    CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
    /** Override do diretório do build da SPA (apps/web/dist). Vazio = auto-resolve. */
    WEB_DIST_PATH: z.string().optional(),
    JWT_SECRET: z.string().default(INSECURE_JWT_DEFAULT),
    /** Validade do JWT de sessão (ADR-0007: 7 dias). */
    JWT_EXPIRES_IN: z.string().default('7d'),
    /** E-mail do dono — único e-mail aceito no login (ADR-0007). */
    AUTH_EMAIL: z
      .string()
      .default('leoferolive@gmail.com')
      .transform((s) => s.trim().toLowerCase()),
    /**
     * Hash bcrypt da senha do dono (ADR-0007). NUNCA guardamos a senha em texto.
     * Em dev/test há um hash default (senha `dev`) para o app subir; em produção
     * é obrigatório e não-vazio (fail-fast).
     */
    AUTH_PASSWORD_HASH: z.string().default(DEV_PASSWORD_HASH),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'production') return;

    // Em produção: JWT_SECRET real, forte e diferente do default inseguro.
    if (!data.JWT_SECRET || data.JWT_SECRET === INSECURE_JWT_DEFAULT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET é obrigatório em produção (não use o default inseguro).',
      });
    } else if (data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET deve ter no mínimo 32 caracteres em produção.',
      });
    }

    // Em produção o hash da senha NÃO pode ser vazio nem o default de dev
    // (senão ninguém — ou qualquer um conhecendo a senha `dev` — entraria).
    if (!data.AUTH_PASSWORD_HASH || data.AUTH_PASSWORD_HASH === DEV_PASSWORD_HASH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_PASSWORD_HASH'],
        message: 'AUTH_PASSWORD_HASH é obrigatório em produção (gere um hash bcrypt real).',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  if (isProd) process.exit(1);
  throw new Error('Variáveis de ambiente inválidas');
}

export const env = parsed.data;
