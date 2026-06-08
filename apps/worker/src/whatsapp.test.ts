import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks de infra (sem Postgres, sem WhatsApp real) ---

vi.mock('./env.js', () => ({
  env: {
    WA_SESSION_PATH: './.session-test',
    WA_RECONNECT_DELAY: 5000,
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    WORKER_HEALTH_PORT: 3001,
    LOG_LEVEL: 'debug',
  },
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => undefined),
  rm: vi.fn(async () => undefined),
}));

vi.mock('@nossoradar/db', () => ({
  insertDetection: vi.fn(async () => 'id'),
  listMonitoredGroupsWithKeywords: vi.fn(async () => []),
  markDetectionNotified: vi.fn(async () => undefined),
  notify: vi.fn(async () => undefined),
  setConnected: vi.fn(async () => undefined),
  setConnecting: vi.fn(async () => undefined),
  setDisconnected: vi.fn(async () => undefined),
  setExhausted: vi.fn(async () => undefined),
  setQrCode: vi.fn(async () => undefined),
  upsertWhatsappGroups: vi.fn(async () => undefined),
}));

vi.mock('./metrics.js', () => ({
  detectionsCounter: { inc: vi.fn() },
  monitoredMessagesCounter: { inc: vi.fn() },
  setWhatsappConnectionState: vi.fn(),
}));

vi.mock('./telegram.js', () => ({
  formatDetectionAlert: vi.fn(() => 'msg'),
  TelegramNotifier: class {
    enqueue = vi.fn();
    stop = vi.fn();
  },
}));

// Cada socket falso registra criação/encerramento numa timeline compartilhada,
// para detectarmos dois sockets vivos ao mesmo tempo.
interface FakeSock {
  id: number;
  ended: boolean;
  ev: { on: ReturnType<typeof vi.fn> };
  end: ReturnType<typeof vi.fn>;
}

const liveSockets = new Set<number>();
let maxConcurrentLive = 0;
let sockSeq = 0;
const makeWASocket = vi.fn((): FakeSock => {
  sockSeq += 1;
  const id = sockSeq;
  liveSockets.add(id);
  maxConcurrentLive = Math.max(maxConcurrentLive, liveSockets.size);
  return {
    id,
    ended: false,
    ev: { on: vi.fn() },
    end: vi.fn(function (this: FakeSock) {
      this.ended = true;
      liveSockets.delete(id);
    }),
  };
});

// `fetchLatestBaileysVersion` é o await mais "lento" (round-trip de rede) dentro do
// connect(); aqui o tornamos controlável (deferred) para forçar a janela de corrida.
let pendingVersionResolvers: Array<() => void> = [];
const fetchLatestBaileysVersion = vi.fn(
  () =>
    new Promise<{ version: number[] }>((resolve) => {
      pendingVersionResolvers.push(() => resolve({ version: [2, 3000, 0] }));
    }),
);

vi.mock('@whiskeysockets/baileys', () => ({
  DisconnectReason: { loggedOut: 401 },
  fetchLatestBaileysVersion: () => fetchLatestBaileysVersion(),
  makeWASocket: () => makeWASocket(),
  useMultiFileAuthState: vi.fn(async () => ({ state: {}, saveCreds: vi.fn() })),
}));

const { WhatsAppWorker } = await import('./whatsapp.js');
const dbMock = await import('@nossoradar/db');
const metricsMock = await import('./metrics.js');

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('WhatsAppWorker.connect() — serialização (ADR-0004)', () => {
  beforeEach(() => {
    liveSockets.clear();
    maxConcurrentLive = 0;
    sockSeq = 0;
    pendingVersionResolvers = [];
    makeWASocket.mockClear();
    fetchLatestBaileysVersion.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('chamadas concorrentes nunca deixam dois sockets vivos', async () => {
    const worker = new WhatsAppWorker();

    // Dispara DOIS connect() concorrentes (ex.: 2 cliques rápidos em "Gerar novo QR").
    const p1 = worker.connect();
    const p2 = worker.connect();

    // Deixa o 1º ciclo correr até travar no fetch de versão (a janela perigosa).
    await flush();
    // Só UM makeWASocket pôde rodar até aqui (o 2º está enfileirado pelo lock).
    expect(makeWASocket).toHaveBeenCalledTimes(0); // ainda travado no fetch
    expect(pendingVersionResolvers.length).toBe(1);

    // Libera o fetch do 1º ciclo → cria o 1º socket; só então o 2º ciclo começa.
    pendingVersionResolvers.shift()?.();
    await p1;
    await flush();

    // O 2º ciclo já fez teardown do 1º socket e está travado no próprio fetch.
    expect(pendingVersionResolvers.length).toBe(1);
    pendingVersionResolvers.shift()?.();
    await p2;
    await flush();

    expect(makeWASocket).toHaveBeenCalledTimes(2); // dois ciclos, sequenciais
    expect(maxConcurrentLive).toBe(1); // NUNCA dois sockets vivos ao mesmo tempo
    expect(liveSockets.size).toBe(1); // sobra exatamente um (o último)
  });

  it('requestReconnect() durante um connect() em voo não cria socket órfão', async () => {
    const worker = new WhatsAppWorker();

    const p1 = worker.connect();
    await flush();
    // Reconexão manual chega no meio do connect() automático.
    const p2 = worker.requestReconnect();
    await flush();

    pendingVersionResolvers.shift()?.();
    await p1;
    await flush();
    pendingVersionResolvers.shift()?.();
    await p2;
    await flush();

    expect(maxConcurrentLive).toBe(1);
    expect(liveSockets.size).toBe(1);
  });
});

describe('WhatsAppWorker.handleMessage() — desfechos (Bug B: extração de texto)', () => {
  const GROUP_JID = '120363000000000000@g.us';

  // Acesso ao método privado + injeção do grupo monitorado (sem Postgres/Baileys).
  function newWorkerMonitoring(keywords: string[]): {
    handle: (msg: unknown) => Promise<void>;
  } {
    const worker = new WhatsAppWorker();
    (worker as unknown as { monitored: Map<string, unknown> }).monitored = new Map([
      [GROUP_JID, { jid: GROUP_JID, name: 'Grupo Teste', enabled: true, keywords }],
    ]);
    return {
      handle: (msg: unknown) =>
        (worker as unknown as { handleMessage: (m: unknown) => Promise<void> }).handleMessage(msg),
    };
  }

  function groupMsg(content: unknown, id = 'm1', ts = 1000): unknown {
    return {
      key: { remoteJid: GROUP_JID, participant: '5511999999999@s.whatsapp.net', id, fromMe: false },
      message: content,
      pushName: 'Fulano',
      messageTimestamp: ts,
    };
  }

  beforeEach(() => {
    vi.mocked(dbMock.insertDetection).mockClear();
    vi.mocked(metricsMock.monitoredMessagesCounter.inc).mockClear();
  });

  it('mensagem efêmera com keyword vira detecção (o caso do IURI)', async () => {
    const { handle } = newWorkerMonitoring(['monitor']);
    await handle(
      groupMsg({ ephemeralMessage: { message: { conversation: 'Oferta: Monitor Gamer 27' } } }),
    );

    expect(dbMock.insertDetection).toHaveBeenCalledTimes(1);
    expect(dbMock.insertDetection).toHaveBeenCalledWith(
      expect.objectContaining({
        groupJid: GROUP_JID,
        matchedKeywords: ['monitor'],
        messageText: 'Oferta: Monitor Gamer 27',
      }),
    );
    expect(metricsMock.monitoredMessagesCounter.inc).toHaveBeenCalledWith({
      group_jid: GROUP_JID,
      outcome: 'detected',
    });
  });

  it('formato de bot (templateMessage) com keyword vira detecção', async () => {
    const { handle } = newWorkerMonitoring(['latam']);
    await handle(
      groupMsg({
        templateMessage: { hydratedTemplate: { hydratedContentText: 'Promo LATAM 100% bônus' } },
      }),
    );
    expect(dbMock.insertDetection).toHaveBeenCalledTimes(1);
  });

  it('mensagem só-mídia (sem texto) NÃO vira detecção e conta como no_text', async () => {
    const { handle } = newWorkerMonitoring(['monitor']);
    await handle(groupMsg({ imageMessage: {} }));

    expect(dbMock.insertDetection).not.toHaveBeenCalled();
    expect(metricsMock.monitoredMessagesCounter.inc).toHaveBeenCalledWith({
      group_jid: GROUP_JID,
      outcome: 'no_text',
    });
  });

  it('texto sem keyword conta como no_match (sem detecção) e loga em debug', async () => {
    const debugSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const { handle } = newWorkerMonitoring(['monitor']);
      await handle(groupMsg({ conversation: 'bom dia pessoal' }));

      expect(dbMock.insertDetection).not.toHaveBeenCalled();
      expect(metricsMock.monitoredMessagesCounter.inc).toHaveBeenCalledWith({
        group_jid: GROUP_JID,
        outcome: 'no_match',
      });
      // LOG_LEVEL=debug (mock) → logDebug do ramo no_match dispara.
      expect(debugSpy.mock.calls.some(([m]) => typeof m === 'string' && m.includes('sem match'))).toBe(
        true,
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('reenvio idêntico no mesmo minuto é colapsado (dedup), só 1 detecção', async () => {
    const { handle } = newWorkerMonitoring(['monitor']);
    await handle(groupMsg({ conversation: 'Monitor 4k' }, 'a', 1000));
    await handle(groupMsg({ conversation: 'Monitor 4k' }, 'b', 1010));

    expect(dbMock.insertDetection).toHaveBeenCalledTimes(1);
    expect(metricsMock.monitoredMessagesCounter.inc).toHaveBeenCalledWith({
      group_jid: GROUP_JID,
      outcome: 'dedup',
    });
  });

  it('grupo não monitorado é ignorado (sem métrica, sem detecção)', async () => {
    const { handle } = newWorkerMonitoring(['monitor']);
    await handle({
      key: { remoteJid: '999@g.us', id: 'x', fromMe: false },
      message: { conversation: 'Monitor barato' },
      messageTimestamp: 1000,
    });
    expect(dbMock.insertDetection).not.toHaveBeenCalled();
    expect(metricsMock.monitoredMessagesCounter.inc).not.toHaveBeenCalled();
  });
});
