import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  PUBLIC_URL: process.env.PUBLIC_URL ?? 'http://localhost:3000',
  /** Origem do SPA para CORS (Fase 4); por padrão o próprio Painel. */
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? process.env.PUBLIC_URL ?? 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-inseguro-troque-por-32+-caracteres-aleatorios',
  /** Validade do JWT de sessão (ADR-0005: 7 dias). */
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '7d',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  /** Allowlist (ADR-0005): SOMENTE estes e-mails podem logar. */
  ALLOWED_EMAILS: (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;

/**
 * Decisão de allowlist (ADR-0005), isolada para ser testável diretamente.
 * Retorna true se o e-mail (case-insensitive) está na allowlist.
 */
export function isEmailAllowed(email: string | undefined | null, allowlist: readonly string[]): boolean {
  if (!email) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
