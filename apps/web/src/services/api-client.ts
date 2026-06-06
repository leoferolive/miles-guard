/**
 * Cliente HTTP do Painel. Single-user, JWT único (sem refresh token — ADR-0007):
 * anexa `Authorization: Bearer <token>` e, em 401, limpa a sessão e redireciona ao login.
 *
 * Espelha o api-client do nossagrana, simplificado para o fluxo de token único do nossoRadar.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getToken: () => string | null;
  /** Chamado em 401: deve limpar o token e (na app real) redirecionar ao login. */
  onUnauthorized: () => void;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly getToken: () => string | null;
  private readonly onUnauthorized: () => void;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchFn = options.fetchFn ?? fetch.bind(globalThis);
    this.getToken = options.getToken;
    this.onUnauthorized = options.onUnauthorized;
  }

  async request<T>(
    path: string,
    options: RequestInit = {},
    opts: { skipUnauthorizedHandler?: boolean } = {},
  ): Promise<T> {
    const { headers, ...rest } = options;
    const token = this.getToken();

    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
      ...rest,
      headers: this.buildHeaders(headers, token),
    });

    if (response.status === 401 && !opts.skipUnauthorizedHandler) {
      // Token ausente/expirado: encerra a sessão (limpa + redireciona).
      this.onUnauthorized();
      throw new ApiError(401, 'Não autorizado');
    }

    if (!response.ok) {
      let message = 'Erro ao processar requisição';
      try {
        const body = (await response.json()) as { message?: string };
        if (body?.message) message = body.message;
      } catch {
        // resposta sem corpo JSON
      }
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(
    path: string,
    body?: unknown,
    opts: { skipUnauthorizedHandler?: boolean } = {},
  ): Promise<T> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      opts,
    );
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  private buildHeaders(headers: HeadersInit | undefined, token: string | null): HeadersInit {
    const parsed = new Headers(headers);
    if (token) {
      parsed.set('Authorization', `Bearer ${token}`);
    }
    return parsed;
  }
}
