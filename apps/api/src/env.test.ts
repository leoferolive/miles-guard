import { describe, expect, it } from 'vitest';

import { DEV_PASSWORD_HASH, parseEnv } from './env.js';

/** Base de prod válida; os testes mutam um campo de cada vez para isolar a regra. */
const validProd = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  AUTH_PASSWORD_HASH: '$2a$10$realhashrealhashrealhashrealhashrealhashreal',
} satisfies NodeJS.ProcessEnv;

/** Caminhos (campos) que falharam na validação. */
function failedPaths(source: NodeJS.ProcessEnv): string[] {
  const r = parseEnv(source);
  expect(r.success).toBe(false);
  if (r.success) return [];
  return r.error.issues.map((i) => String(i.path[0]));
}

describe('parseEnv — fail-fast em produção (ADR-0007)', () => {
  it('aceita uma config de prod válida', () => {
    expect(parseEnv(validProd).success).toBe(true);
  });

  it('rejeita AUTH_PASSWORD_HASH ausente em produção', () => {
    const { AUTH_PASSWORD_HASH: _omit, ...source } = validProd;
    expect(failedPaths(source)).toContain('AUTH_PASSWORD_HASH');
  });

  it('rejeita o hash dev-default em produção', () => {
    expect(failedPaths({ ...validProd, AUTH_PASSWORD_HASH: DEV_PASSWORD_HASH })).toContain(
      'AUTH_PASSWORD_HASH',
    );
  });

  it('rejeita JWT_SECRET com menos de 32 caracteres em produção', () => {
    expect(failedPaths({ ...validProd, JWT_SECRET: 'curto' })).toContain('JWT_SECRET');
  });

  it('rejeita JWT_SECRET ausente (cai no default inseguro) em produção', () => {
    const { JWT_SECRET: _omit, ...source } = validProd;
    expect(failedPaths(source)).toContain('JWT_SECRET');
  });
});

describe('parseEnv — defaults amigáveis fora de produção', () => {
  it('carrega com defaults em development (sem segredos)', () => {
    const r = parseEnv({ NODE_ENV: 'development' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.AUTH_EMAIL).toBe('leoferolive@gmail.com');
      expect(r.data.AUTH_PASSWORD_HASH).toBe(DEV_PASSWORD_HASH);
      expect(r.data.JWT_EXPIRES_IN).toBe('7d');
    }
  });

  it('normaliza AUTH_EMAIL para minúsculas e sem espaços', () => {
    const r = parseEnv({ NODE_ENV: 'development', AUTH_EMAIL: '  DONO@Example.com ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.AUTH_EMAIL).toBe('dono@example.com');
  });
});
