import { describe, expect, it } from 'vitest';

import { LoginFailureGuard } from './login-failure-guard.js';

describe('LoginFailureGuard', () => {
  it('reserva a vaga ANTES da verificação: tentativas simultâneas não passam do máximo', () => {
    const guard = new LoginFailureGuard({ maxFailures: 2, windowMs: 1000, now: () => 0 });

    // Três tentativas "em voo" ao mesmo tempo (nenhuma terminou o bcrypt ainda).
    expect(guard.tryAcquire()).not.toBeNull();
    expect(guard.tryAcquire()).not.toBeNull();
    expect(guard.tryAcquire()).toBeNull();
  });

  it('login bem-sucedido devolve a vaga (não conta como falha)', () => {
    const guard = new LoginFailureGuard({ maxFailures: 1, windowMs: 1000, now: () => 0 });
    const attempt = guard.tryAcquire();
    expect(attempt).not.toBeNull();
    guard.release(attempt!);
    expect(guard.tryAcquire()).not.toBeNull();
  });

  it('libera quando as falhas saem da janela (janela deslizante)', () => {
    let now = 0;
    const guard = new LoginFailureGuard({ maxFailures: 2, windowMs: 1000, now: () => now });
    guard.tryAcquire();
    now = 500;
    guard.tryAcquire();
    expect(guard.tryAcquire()).toBeNull();

    now = 1001; // a 1ª falha expirou
    expect(guard.tryAcquire()).not.toBeNull();
  });
});
