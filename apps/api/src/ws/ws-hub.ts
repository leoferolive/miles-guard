import type { WebSocket } from 'ws';

/**
 * Mantém o conjunto de clientes WebSocket autenticados e faz broadcast dos eventos
 * recebidos do barramento Postgres LISTEN/NOTIFY (ADR-0003). Single-user: uma "sala" só.
 */
export class WsHub {
  private clients = new Set<WebSocket>();

  add(ws: WebSocket): void {
    this.clients.add(ws);
  }

  remove(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  size(): number {
    return this.clients.size;
  }

  /** Envia `{ channel, payload }` a todos os clientes conectados (readyState OPEN). */
  broadcast(channel: string, payload: string): void {
    const msg = JSON.stringify({ channel, payload });
    for (const ws of this.clients) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(msg);
      }
    }
  }
}
