import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// --- Mock da camada @nossoradar/db (sem Postgres real) ---
const upsertUser = vi.fn(async (args: { email: string; name?: string | null }) => ({
  id: '00000000-0000-0000-0000-000000000001',
  email: args.email,
  name: args.name ?? null,
  avatarUrl: null,
}));

vi.mock('@nossoradar/db', () => ({
  upsertUser,
  getUserById: vi.fn(async (id: string) => ({
    id,
    email: 'dono@example.com',
    name: 'dono',
    avatarUrl: null,
  })),
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

// O ambiente de teste fixa AUTH_EMAIL='dono@example.com' e o hash bcrypt da senha
// `senha-correta` (ver vitest.setup.ts).
describe('POST /api/auth/login (ADR-0007)', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterEach(() => {
    upsertUser.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('e-mail + senha corretos → 200, token e usuário; faz upsert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'dono@example.com', password: 'senha-correta' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { token: string; user: { email: string } };
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.user.email).toBe('dono@example.com');
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'dono@example.com', name: 'dono' }),
    );

    // O token emitido é o mesmo JWT de sessão e abre /api/me.
    const me = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(me.statusCode).toBe(200);
  });

  it('e-mail certo, senha errada → 401 genérico e NÃO faz upsert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'dono@example.com', password: 'senha-errada' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ message: 'Credenciais inválidas.' });
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('e-mail errado, senha certa → 401 genérico e NÃO faz upsert', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'intruso@example.com', password: 'senha-correta' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ message: 'Credenciais inválidas.' });
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it('é case-insensitive no e-mail (normaliza para minúsculas)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: '  DONO@Example.com ', password: 'senha-correta' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('body malformado → 401 genérico (não 400, sem vazar a forma)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'naoeemail', password: '' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ message: 'Credenciais inválidas.' });
  });
});

// O rate-limit por-rota só atua quando o @fastify/rate-limit está registrado (fora
// de teste). Montamos um app mínimo só com o plugin + a rota para provar o limite.
describe('rate-limit estrito em /api/auth/login', () => {
  it('bloqueia (429) após exceder o limite por-rota', async () => {
    const Fastify = (await import('fastify')).default;
    const { authRoutes } = await import('./routes/auth.routes.js');
    const { authPlugin } = await import('./plugins/auth.plugin.js');

    const app = Fastify();
    await app.register(import('@fastify/rate-limit'), { global: false });
    await app.register(authPlugin);
    await app.register(authRoutes, { prefix: '/api' });
    await app.ready();

    const attempts: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'dono@example.com', password: 'senha-errada' },
      });
      attempts.push(res.statusCode);
    }

    // As 5 primeiras são 401 (credenciais), as seguintes 429 (rate-limit).
    expect(attempts.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(attempts.includes(429)).toBe(true);

    await app.close();
  });
});
