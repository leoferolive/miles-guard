import { describe, expect, it } from 'vitest';

import { isEmailAllowed } from './env.js';

describe('isEmailAllowed (allowlist — ADR-0005)', () => {
  const allowlist = ['dono@example.com'];

  it('permite e-mail na allowlist', () => {
    expect(isEmailAllowed('dono@example.com', allowlist)).toBe(true);
  });

  it('é case-insensitive e ignora espaços', () => {
    expect(isEmailAllowed('  DONO@Example.com ', allowlist)).toBe(true);
  });

  it('nega e-mail fora da allowlist', () => {
    expect(isEmailAllowed('intruso@example.com', allowlist)).toBe(false);
  });

  it('nega quando o e-mail é vazio/ausente', () => {
    expect(isEmailAllowed(undefined, allowlist)).toBe(false);
    expect(isEmailAllowed(null, allowlist)).toBe(false);
    expect(isEmailAllowed('', allowlist)).toBe(false);
  });

  it('nega quando a allowlist está vazia', () => {
    expect(isEmailAllowed('dono@example.com', [])).toBe(false);
  });
});
