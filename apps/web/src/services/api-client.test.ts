import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiError } from './api-client';

describe('ApiClient', () => {
  let token: string | null;
  let onUnauthorized: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    token = 'jwt-abc';
    onUnauthorized = vi.fn();
  });

  const build = (fetchFn: typeof fetch) =>
    new ApiClient({
      baseUrl: 'http://localhost:3000',
      fetchFn,
      getToken: () => token,
      onUnauthorized,
    });

  it('anexa Authorization: Bearer <token> quando há token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = build(fetchMock as unknown as typeof fetch);
    const result = await client.get<{ ok: boolean }>('/api/me');

    expect(result).toEqual({ ok: true });
    const headers = new Headers(fetchMock.mock.calls[0]![1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt-abc');
  });

  it('NÃO anexa Authorization quando não há token', async () => {
    token = null;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = build(fetchMock as unknown as typeof fetch);
    await client.get('/api/connection');

    const headers = new Headers(fetchMock.mock.calls[0]![1]?.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('em 401 chama onUnauthorized e lança ApiError(401)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const client = build(fetchMock as unknown as typeof fetch);

    await expect(client.get('/api/me')).rejects.toBeInstanceOf(ApiError);
    await expect(client.get('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('em 401 com skipUnauthorizedHandler NÃO chama onUnauthorized (login)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Credenciais inválidas.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = build(fetchMock as unknown as typeof fetch);

    // O 401 vira um erro com a mensagem do servidor (não o redirect global).
    await expect(
      client.post('/api/auth/login', { email: 'x', password: 'y' }, { skipUnauthorizedHandler: true }),
    ).rejects.toThrow('Credenciais inválidas.');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('retorna undefined em 204 (No Content)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = build(fetchMock as unknown as typeof fetch);

    const result = await client.delete('/api/groups/abc');
    expect(result).toBeUndefined();
  });

  it('serializa o body JSON em POST e seta Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = build(fetchMock as unknown as typeof fetch);

    await client.post('/api/groups', { jid: '1@g.us', name: 'X' });

    const init = fetchMock.mock.calls[0]![1];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ jid: '1@g.us', name: 'X' }));
    const headers = new Headers(init?.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('propaga a mensagem do servidor em erros não-401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Requisição inválida.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = build(fetchMock as unknown as typeof fetch);

    await expect(client.post('/api/groups', {})).rejects.toThrow('Requisição inválida.');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
