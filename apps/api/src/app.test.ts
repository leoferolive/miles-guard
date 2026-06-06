import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock da camada @nossoradar/db (sem Postgres real) ---
const now = new Date('2026-06-06T00:00:00.000Z');

const store = {
  groups: [] as Array<{
    id: string;
    jid: string;
    name: string;
    enabled: boolean;
    createdAt: Date;
    keywords: Array<{ id: string; monitoredGroupId: string; term: string; createdAt: Date }>;
  }>,
};

let seq = 0;
const nextId = (): string => {
  seq += 1;
  return `00000000-0000-0000-0000-${String(seq).padStart(12, '0')}`;
};

const notify = vi.fn(async () => undefined);

vi.mock('@nossoradar/db', () => ({
  notify,
  getUserById: vi.fn(async (id: string) => ({
    id,
    email: 'dono@example.com',
    name: 'Dono',
    avatarUrl: null,
  })),
  upsertUser: vi.fn(async (args: { email: string }) => ({
    id: nextId(),
    email: args.email,
    name: null,
    avatarUrl: null,
  })),
  getConnectionState: vi.fn(async () => ({
    status: 'connected',
    qr: null,
    lastConnectedAt: now,
    updatedAt: now,
  })),
  listWhatsappGroups: vi.fn(async () => [
    { jid: '123@g.us', name: 'Grupo Vivo', participantCount: 10, updatedAt: now },
  ]),
  listMonitoredGroups: vi.fn(async () => store.groups),
  createMonitoredGroup: vi.fn(
    async (args: { jid: string; name: string; keywords?: string[] }) => {
      const group = {
        id: nextId(),
        jid: args.jid,
        name: args.name,
        enabled: true,
        createdAt: now,
        keywords: (args.keywords ?? []).map((term) => ({
          id: nextId(),
          monitoredGroupId: '',
          term,
          createdAt: now,
        })),
      };
      store.groups.push(group);
      return group;
    },
  ),
  setMonitoredGroupEnabled: vi.fn(async (id: string, enabled: boolean) => {
    const g = store.groups.find((x) => x.id === id);
    if (!g) return null;
    g.enabled = enabled;
    return g;
  }),
  deleteMonitoredGroup: vi.fn(async (id: string) => {
    const i = store.groups.findIndex((x) => x.id === id);
    if (i === -1) return false;
    store.groups.splice(i, 1);
    return true;
  }),
  addKeyword: vi.fn(async (groupId: string, term: string) => {
    const g = store.groups.find((x) => x.id === groupId);
    if (!g) return null;
    const kw = { id: nextId(), monitoredGroupId: groupId, term, createdAt: now };
    g.keywords.push(kw);
    return kw;
  }),
  deleteKeyword: vi.fn(async (id: string) => {
    for (const g of store.groups) {
      const i = g.keywords.findIndex((k) => k.id === id);
      if (i !== -1) {
        g.keywords.splice(i, 1);
        return true;
      }
    }
    return false;
  }),
  listDetections: vi.fn(async (filters: Record<string, unknown> = {}) => ({
    items: [
      {
        id: '00000000-0000-0000-0000-0000000000d1',
        groupJid: '111@g.us',
        groupName: 'Passagens SUL',
        sender: 'fulano',
        messageText: '100% bonus latam',
        matchedKeywords: ['latam'],
        messageId: 'msg-1',
        detectedAt: now,
        notifiedTelegram: true,
      },
    ],
    total: 1,
    limit: (filters.limit as number | undefined) ?? 50,
    offset: (filters.offset as number | undefined) ?? 0,
  })),
  getStats: vi.fn(async () => ({
    totalDetections: 3,
    perGroup: [{ groupJid: '111@g.us', groupName: 'Passagens SUL', count: 3 }],
    topKeywords: [{ keyword: 'latam', count: 2 }],
  })),
  listen: vi.fn(async () => async () => undefined),
  closeDb: vi.fn(async () => undefined),
}));

const dbMock = await import('@nossoradar/db');

const { buildApp } = await import('./app.js');

type App = ReturnType<typeof buildApp>;

const token = (app: App): string =>
  app.jwt.sign({ sub: '00000000-0000-0000-0000-0000000000aa', email: 'dono@example.com' });

describe('nossoRadar API', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    store.groups = [];
    notify.mockClear();
  });

  it('GET /healthz responde ok sem auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /metrics expõe registro Prometheus real sem auth', async () => {
    // Gera ao menos um request contado antes do scrape.
    await app.inject({ method: 'GET', url: '/healthz' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    // Métricas padrão de processo + o contador de requests HTTP do Painel.
    expect(res.body).toContain('nossoradar_web_process_cpu_seconds_total');
    expect(res.body).toContain('nossoradar_web_http_requests_total');
  });

  it('rejeita rotas protegidas sem JWT (401)', async () => {
    for (const url of [
      '/api/me',
      '/api/connection',
      '/api/groups',
      '/api/whatsapp/groups',
      '/api/detections',
      '/api/stats',
    ]) {
      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode, url).toBe(401);
    }
  });

  it('rejeita JWT inválido (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer not-a-valid-token' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/me retorna o usuário autenticado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${token(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ email: 'dono@example.com' });
  });

  it('GET /api/connection retorna o estado da conexão', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/connection',
      headers: { authorization: `Bearer ${token(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'connected', qr: null });
  });

  it('CRUD de Grupos Monitorados + keywords (happy-path) e NOTIFY config_changed', async () => {
    const auth = { authorization: `Bearer ${token(app)}` };

    // create
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: auth,
      payload: { jid: '111@g.us', name: 'Passagens SUL', keywords: ['latam', 'bonus'] },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as { id: string; keywords: unknown[] };
    expect(created.keywords).toHaveLength(2);
    expect(notify).toHaveBeenCalledWith('config_changed');

    // list
    const listRes = await app.inject({ method: 'GET', url: '/api/groups', headers: auth });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(1);

    // patch enabled
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${created.id}`,
      headers: auth,
      payload: { enabled: false },
    });
    expect(patchRes.statusCode).toBe(200);
    expect((patchRes.json() as { enabled: boolean }).enabled).toBe(false);

    // add keyword
    const kwRes = await app.inject({
      method: 'POST',
      url: `/api/groups/${created.id}/keywords`,
      headers: auth,
      payload: { term: '100%' },
    });
    expect(kwRes.statusCode).toBe(201);
    const kw = kwRes.json() as { id: string; term: string };
    expect(kw.term).toBe('100%');

    // delete keyword
    const delKwRes = await app.inject({
      method: 'DELETE',
      url: `/api/keywords/${kw.id}`,
      headers: auth,
    });
    expect(delKwRes.statusCode).toBe(204);

    // delete group
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/groups/${created.id}`,
      headers: auth,
    });
    expect(delRes.statusCode).toBe(204);

    const finalList = await app.inject({ method: 'GET', url: '/api/groups', headers: auth });
    expect(finalList.json()).toHaveLength(0);
  });

  it('PATCH/DELETE de grupo inexistente retorna 404', async () => {
    const auth = { authorization: `Bearer ${token(app)}` };
    const id = '00000000-0000-0000-0000-0000000000ff';

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/groups/${id}`,
      headers: auth,
      payload: { enabled: true },
    });
    expect(patchRes.statusCode).toBe(404);

    const delRes = await app.inject({ method: 'DELETE', url: `/api/groups/${id}`, headers: auth });
    expect(delRes.statusCode).toBe(404);
  });

  it('POST /api/whatsapp/refresh dispara NOTIFY refresh_groups', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/whatsapp/refresh',
      headers: { authorization: `Bearer ${token(app)}` },
    });
    expect(res.statusCode).toBe(202);
    expect(notify).toHaveBeenCalledWith('refresh_groups');
  });

  it('POST /api/groups com body malformado retorna 400 (não 500)', async () => {
    const auth = { authorization: `Bearer ${token(app)}` };

    // falta `name` (obrigatório)
    const missingName = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: auth,
      payload: { jid: '111@g.us', keywords: ['x'] },
    });
    expect(missingName.statusCode).toBe(400);

    // tipos errados
    const wrongTypes = await app.inject({
      method: 'POST',
      url: '/api/groups',
      headers: auth,
      payload: { jid: 123, name: '', keywords: 'naolista' },
    });
    expect(wrongTypes.statusCode).toBe(400);
  });

  it('GET /api/detections com query inválida retorna 400', async () => {
    const auth = { authorization: `Bearer ${token(app)}` };

    const badLimit = await app.inject({
      method: 'GET',
      url: '/api/detections?limit=abc',
      headers: auth,
    });
    expect(badLimit.statusCode).toBe(400);

    const badSince = await app.inject({
      method: 'GET',
      url: '/api/detections?since=naodata',
      headers: auth,
    });
    expect(badSince.statusCode).toBe(400);
  });

  it('GET /api/detections aplica filtros/paginação e molda a resposta', async () => {
    const auth = { authorization: `Bearer ${token(app)}` };

    const res = await app.inject({
      method: 'GET',
      url: '/api/detections?limit=10&offset=5&groupJid=111@g.us&keyword=latam&since=2026-06-01T00:00:00.000Z',
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: unknown[]; total: number; limit: number; offset: number };
    expect(body.total).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(5);
    expect(body.items).toHaveLength(1);

    // o repo recebeu os filtros já parseados (limit/offset numéricos, since como Date)
    expect(dbMock.listDetections).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
        offset: 5,
        groupJid: '111@g.us',
        keyword: 'latam',
        since: expect.any(Date),
      }),
    );
  });

  it('GET /api/stats retorna totais, contagem por grupo e top keywords', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/stats',
      headers: { authorization: `Bearer ${token(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      totalDetections: 3,
      perGroup: [{ groupJid: '111@g.us', count: 3 }],
      topKeywords: [{ keyword: 'latam', count: 2 }],
    });
  });
});
