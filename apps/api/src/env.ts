import 'dotenv/config';

export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  PUBLIC_URL: process.env.PUBLIC_URL ?? 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-inseguro-troque-por-32+-caracteres-aleatorios',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  /** Allowlist (ADR-0005): SOMENTE estes e-mails podem logar. */
  ALLOWED_EMAILS: (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;
