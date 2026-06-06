import '@testing-library/jest-dom/vitest';

// jsdom não implementa WebSocket — stub mínimo para evitar ReferenceError nos testes.
if (typeof globalThis.WebSocket === 'undefined') {
  class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 0;
    url: string;
    onopen: (() => void) | null = null;
    onclose: ((ev: { code: number }) => void) | null = null;
    onmessage: ((ev: { data: string }) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(url: string) {
      this.url = url;
    }
    close() {
      this.readyState = 3;
    }
    send() {}
  }
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
}
