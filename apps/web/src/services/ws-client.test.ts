import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WsClient } from './ws-client';

/**
 * Fake WebSocket controlável: registra cada instância criada e expõe helpers
 * para simular open/close/message (jsdom não implementa WebSocket — ver test/setup.ts).
 */
class ControllableWebSocket {
  static instances: ControllableWebSocket[] = [];
  static reset() {
    ControllableWebSocket.instances = [];
  }

  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closeSpy = vi.fn();

  constructor(url: string) {
    this.url = url;
    ControllableWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3;
    this.closeSpy();
  }

  // helpers de teste
  fireOpen() {
    this.readyState = 1;
    this.onopen?.();
  }
  fireClose(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  fireMessage(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }

  static get last(): ControllableWebSocket {
    const arr = ControllableWebSocket.instances;
    return arr[arr.length - 1]!;
  }
}

describe('WsClient', () => {
  let originalWs: typeof WebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    originalWs = globalThis.WebSocket;
    ControllableWebSocket.reset();
    globalThis.WebSocket = ControllableWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWs;
    vi.useRealTimers();
  });

  it('abre uma conexão com o token na URL e emite status connecting→connected', () => {
    const client = new WsClient();
    const statuses: string[] = [];
    client.onStatus((s) => statuses.push(s));

    client.connect('jwt-1');
    expect(ControllableWebSocket.instances).toHaveLength(1);
    expect(ControllableWebSocket.last.url).toContain('token=jwt-1');

    ControllableWebSocket.last.fireOpen();
    expect(statuses).toContain('connecting');
    expect(statuses).toContain('connected');
    expect(client.getStatus()).toBe('connected');
  });

  it('reconecta em close inesperado (1006) após o backoff', () => {
    const client = new WsClient();
    client.connect('jwt-1');
    ControllableWebSocket.last.fireOpen();

    ControllableWebSocket.last.fireClose(1006);
    expect(ControllableWebSocket.instances).toHaveLength(1); // ainda não reconectou

    vi.advanceTimersByTime(600); // BASE_DELAY_MS=500 * 2^0
    expect(ControllableWebSocket.instances).toHaveLength(2); // reconectou
  });

  it('para de reconectar após MAX_RETRIES', () => {
    const client = new WsClient();
    client.connect('jwt-1');

    // dispara MAX_RETRIES (6) reconexões; a 7ª tentativa não acontece.
    for (let i = 0; i < 10; i += 1) {
      ControllableWebSocket.last.fireClose(1006);
      vi.advanceTimersByTime(MAX_DELAY_PLUS);
    }
    // 1 inicial + 6 reconexões = 7 instâncias no máximo.
    expect(ControllableWebSocket.instances.length).toBe(7);
  });

  it('NÃO reconecta em close 4001 (token inválido)', () => {
    const client = new WsClient();
    client.connect('jwt-1');

    ControllableWebSocket.last.fireClose(4001);
    vi.advanceTimersByTime(MAX_DELAY_PLUS);
    expect(ControllableWebSocket.instances).toHaveLength(1);
    expect(client.getStatus()).toBe('disconnected');
  });

  it('NÃO reconecta após disconnect() manual', () => {
    const client = new WsClient();
    client.connect('jwt-1');
    ControllableWebSocket.last.fireOpen();

    client.disconnect();
    expect(client.getStatus()).toBe('disconnected');

    // mesmo que o socket dispare close depois, não reconecta.
    vi.advanceTimersByTime(MAX_DELAY_PLUS);
    expect(ControllableWebSocket.instances).toHaveLength(1);
  });

  it('faz fan-out de mensagens a todos os listeners e respeita unsubscribe', () => {
    const client = new WsClient();
    client.connect('jwt-1');
    ControllableWebSocket.last.fireOpen();

    const a = vi.fn();
    const b = vi.fn();
    const unsubA = client.onMessage(a);
    client.onMessage(b);

    ControllableWebSocket.last.fireMessage({ channel: 'detection_created', payload: 'id-1' });
    expect(a).toHaveBeenCalledWith({ channel: 'detection_created', payload: 'id-1' });
    expect(b).toHaveBeenCalledWith({ channel: 'detection_created', payload: 'id-1' });

    unsubA();
    ControllableWebSocket.last.fireMessage({ channel: 'connection_state', payload: '' });
    expect(a).toHaveBeenCalledTimes(1); // não recebe mais
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('ignora mensagens malformadas (JSON inválido)', () => {
    const client = new WsClient();
    client.connect('jwt-1');
    ControllableWebSocket.last.fireOpen();

    const listener = vi.fn();
    client.onMessage(listener);
    ControllableWebSocket.last.fireMessage('{nao-e-json');
    expect(listener).not.toHaveBeenCalled();
  });
});

// folga maior que MAX_DELAY_MS (15s) p/ garantir que qualquer timer de reconexão dispare.
const MAX_DELAY_PLUS = 20_000;
