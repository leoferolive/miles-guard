import { beforeEach, describe, expect, it } from 'vitest';

import { clearStoredToken, getStoredToken, setStoredToken } from './token-storage';

describe('token-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('retorna null quando não há token', () => {
    expect(getStoredToken()).toBeNull();
  });

  it('persiste e lê o token', () => {
    setStoredToken('jwt-xyz');
    expect(getStoredToken()).toBe('jwt-xyz');
  });

  it('limpa o token (logout / 401)', () => {
    setStoredToken('jwt-xyz');
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
  });

  it('trata string vazia como ausência de token', () => {
    setStoredToken('');
    expect(getStoredToken()).toBeNull();
  });
});
