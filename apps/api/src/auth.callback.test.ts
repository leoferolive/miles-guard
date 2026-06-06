import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Habilita o OAuth NESTE arquivo (o setup global deixa as credenciais vazias).
process.env.GOOGLE_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

const upsertUser = vi.fn(async (args: { email: string }) => ({
  id: '00000000-0000-0000-0000-000000000001',
  email: args.email,
  name: null,
  avatarUrl: null,
}));

vi.mock('@nossoradar/db', () => ({
  upsertUser,
  getUserById: vi.fn(),
  getConnectionState: vi.fn(),
  listWhatsappGroups: vi.fn(),
  listMonitoredGroups: vi.fn(),
  createMonitoredGroup: vi.fn(),
  setMonitoredGroupEnabled: vi.fn(),
  deleteMonitoredGroup: vi.fn(),
  addKeyword: vi.fn(),
  deleteKeyword: vi.fn(),
  listDetections: vi.fn(),
  getStats: vi.fn(),
  notify: vi.fn(async () => undefined),
  listen: vi.fn(async () => async () => undefined),
  closeDb: vi.fn(async () => undefined),
}));

const { buildApp } = await import('./app.js');

/** Stub do userinfo do Google (controla o e-mail/verificação retornados). */
function stubUserinfo(payload: Record<string, unknown>): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => payload })) as unknown as typeof fetch,
  );
}

describe('callback OAuth + allowlist (nível HTTP)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
    // Stub da troca de code → token (sem chamar o Google de verdade).
    const oauth = (app as unknown as {
      googleOAuth2: { getAccessTokenFromAuthorizationCodeFlow: unknown };
    }).googleOAuth2;
    oauth.getAccessTokenFromAuthorizationCodeFlow = vi.fn(async () => ({
      token: { access_token: 'fake-access-token' },
    }));
  });

  afterEach(() => {
    upsertUser.mockClear();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await app.close();
  });

  it('nega e-mail FORA da allowlist com 403 e NÃO cria usuário', async () => {
    stubUserinfo({ email: 'intruso@example.com', email_verified: true });

    const res = await app.inject({ method: 'GET', url: '/api/auth/google/callback?code=x' });

    expect(res.statusCode).toBe(403);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('rejeita e-mail não verificado com 403 antes da allowlist', async () => {
    stubUserinfo({ email: 'dono@example.com', email_verified: false });

    const res = await app.inject({ method: 'GET', url: '/api/auth/google/callback?code=x' });

    expect(res.statusCode).toBe(403);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('permite e-mail DA allowlist (verificado): upsert + redirect com token', async () => {
    stubUserinfo({ email: 'dono@example.com', email_verified: true, name: 'Dono' });

    const res = await app.inject({ method: 'GET', url: '/api/auth/google/callback?code=x' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/\/auth\/callback\?token=/);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'dono@example.com' }),
    );
  });
});
