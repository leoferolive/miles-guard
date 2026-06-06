import { config } from 'dotenv';
import { z } from 'zod';

config();

const INSECURE_JWT_DEFAULT = 'dev-inseguro-troque-por-32+-caracteres-aleatorios';

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
    JWT_SECRET: z.string().default(INSECURE_JWT_DEFAULT),
    /** Validade do JWT de sessão (ADR-0005: 7 dias). */
    JWT_EXPIRES_IN: z.string().default('7d'),
    GOOGLE_CLIENT_ID: z.string().default(''),
    GOOGLE_CLIENT_SECRET: z.string().default(''),
    /** Allowlist (ADR-0005): SOMENTE estes e-mails podem logar. */
    ALLOWED_EMAILS: z
      .string()
      .default('')
      .transform((raw) =>
        raw
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
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

    // Em produção a allowlist NÃO pode ser vazia (senão ninguém — ou qualquer um — entra).
    if (data.ALLOWED_EMAILS.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOWED_EMAILS'],
        message: 'ALLOWED_EMAILS é obrigatório em produção (não pode ser vazio).',
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

/**
 * Decisão de allowlist (ADR-0005), isolada para ser testável diretamente.
 * Retorna true se o e-mail (case-insensitive) está na allowlist.
 */
export function isEmailAllowed(
  email: string | undefined | null,
  allowlist: readonly string[],
): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
