import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks de infra (sem Postgres, sem WhatsApp real) ---

vi.mock('./env.js', () => ({
  env: {
    WA_SESSION_PATH: './.session-test',
    WA_RECONNECT_DELAY: 5000,
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    WORKER_HEALTH_PORT: 3001,
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
