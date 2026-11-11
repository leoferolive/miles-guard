import { describe, expect, it } from 'vitest';

import { LoginFailureGuard } from './login-failure-guard.js';

describe('LoginFailureGuard', () => {
  it('bloqueia ao atingir o máximo de falhas dentro da janela', () => {
    let now = 0;
    const guard = new LoginFailureGuard({ maxFailures: 2, windowMs: 1000, now: () => now });

    expect(guard.isLocked()).toBe(false);
    guard.recordFailure();
    expect(guard.isLocked()).toBe(false);
    guard.recordFailure();
    expect(guard.isLocked()).toBe(true);

    now = 999;
    expect(guard.isLocked()).toBe(true);
  });

  it('libera quando as falhas saem da janela (janela deslizante)', () => {
    let now = 0;
    const guard = new LoginFailureGuard({ maxFailures: 2, windowMs: 1000, now: () => now });
    guard.recordFailure();
    now = 500;
    guard.recordFailure();
    expect(guard.isLocked()).toBe(true);

    now = 1001; // a 1ª falha expirou
    expect(guard.isLocked()).toBe(false);
  });
});
