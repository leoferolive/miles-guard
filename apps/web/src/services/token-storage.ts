/**
 * Persistência do JWT de sessão no localStorage (single-user, token único).
 * Isolado para ser testável diretamente.
 */
const TOKEN_STORAGE_KEY = 'nossoradar.auth.token';

export function getStoredToken(): string | null {
  try {
    const value = localStorage.getItem(TOKEN_STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage indisponível (ex.: modo privado) — ignora.
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignora
  }
}
