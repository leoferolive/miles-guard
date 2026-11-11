export interface LoginFailureGuardOptions {
  /** Tentativas (de qualquer IP) que travam o login durante a janela. */
  maxFailures: number;
  /** Tamanho da janela deslizante, em ms. */
  windowMs: number;
  now?: () => number;
}

/** Vaga reservada por uma tentativa de login em andamento. */
export interface LoginAttempt {
  readonly at: number;
}

/**
 * Trava GLOBAL de falhas de login, independente do IP: limita brute force distribuído
 * (muitos IPs) que o rate-limit por IP não pega. Em memória — o web roda com 1 réplica.
 *
 * A tentativa reserva a vaga ANTES do bcrypt (`tryAcquire`) e só a devolve se o login
 * der certo (`release`). Registrar a falha só depois do bcrypt deixava N requisições
 * simultâneas passarem pela checagem antes de qualquer uma contar.
 */
export class LoginFailureGuard {
  private attempts: LoginAttempt[] = [];
  private readonly now: () => number;

  constructor(private readonly options: LoginFailureGuardOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Reserva uma vaga; `null` = travado (responder 429 sem verificar a senha). */
  tryAcquire(): LoginAttempt | null {
    this.prune();
    if (this.attempts.length >= this.options.maxFailures) return null;
    const attempt: LoginAttempt = { at: this.now() };
    this.attempts.push(attempt);
    return attempt;
  }

  /** Devolve a vaga de uma tentativa que não deve contar como falha (login ok). */
  release(attempt: LoginAttempt): void {
    this.attempts = this.attempts.filter((a) => a !== attempt);
  }

  private prune(): void {
    const cutoff = this.now() - this.options.windowMs;
    this.attempts = this.attempts.filter((a) => a.at > cutoff);
  }
}
