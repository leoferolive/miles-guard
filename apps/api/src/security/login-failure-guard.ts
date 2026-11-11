export interface LoginFailureGuardOptions {
  /** Falhas de login (de qualquer IP) que travam o login durante a janela. */
  maxFailures: number;
  /** Tamanho da janela deslizante, em ms. */
  windowMs: number;
  now?: () => number;
}

/**
 * Trava GLOBAL de falhas de login, independente do IP: limita brute force distribuído
 * (muitos IPs) que o rate-limit por IP não pega. Em memória — o web roda com 1 réplica.
 * Enquanto travado, o login responde 429 antes do bcrypt (nem a senha certa entra).
 */
export class LoginFailureGuard {
  private failures: number[] = [];
  private readonly now: () => number;

  constructor(private readonly options: LoginFailureGuardOptions) {
    this.now = options.now ?? Date.now;
  }

  isLocked(): boolean {
    this.prune();
    return this.failures.length >= this.options.maxFailures;
  }

  recordFailure(): void {
    this.prune();
    this.failures.push(this.now());
  }

  private prune(): void {
    const cutoff = this.now() - this.options.windowMs;
    this.failures = this.failures.filter((t) => t > cutoff);
  }
}
