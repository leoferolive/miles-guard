import { NOTIFY_CHANNELS, type NotifyChannel } from '@nossoradar/shared';

/** Mensagem do barramento, exatamente como o WsHub do Painel faz broadcast. */
export interface WsMessage {
  channel: NotifyChannel | string;
  /** payload bruto do NOTIFY (string; pode ser vazia ou um id, conforme o canal). */
  payload: string;
}

export type WsStatus = 'disconnected' | 'connecting' | 'connected';
type MessageListener = (msg: WsMessage) => void;
type StatusListener = (status: WsStatus) => void;

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 15_000;

function resolveWsUrl(token: string): string {
  if (typeof window === 'undefined') {
    return `ws://localhost:3000/ws?token=${encodeURIComponent(token)}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Cliente WebSocket do browser → Painel (`/ws?token=`). Reconecta com backoff
 * exponencial em quedas e entrega `{ channel, payload }` aos assinantes.
 * Single-user: uma conexão por sessão.
 */
export class WsClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private manualClose = false;
  private status: WsStatus = 'disconnected';
  private readonly messageListeners = new Set<MessageListener>();
  private readonly statusListeners = new Set<StatusListener>();

  connect(token: string): void {
    this.token = token;
    this.manualClose = false;
    this.retryCount = 0;
    this.clearRetry();
    this.open();
  }

  disconnect(): void {
    this.manualClose = true;
    this.clearRetry();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.setStatus('disconnected');
  }

  getStatus(): WsStatus {
    return this.status;
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private open(): void {
    if (!this.token || typeof WebSocket === 'undefined') {
      this.setStatus('disconnected');
      return;
    }

    this.setStatus('connecting');
    const ws = new WebSocket(resolveWsUrl(this.token));
    this.socket = ws;

    ws.onopen = () => {
      this.retryCount = 0;
      this.setStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as WsMessage;
        if (parsed && typeof parsed.channel === 'string') {
          for (const listener of this.messageListeners) listener(parsed);
        }
      } catch {
        // ignora mensagens malformadas
      }
    };

    ws.onclose = (event) => {
      this.socket = null;
      this.setStatus('disconnected');
      if (this.manualClose) return;

      // 4001 = token ausente/inválido: não adianta reconectar.
      if (event.code === 4001) return;

      if (this.retryCount < MAX_RETRIES) {
        const delay = Math.min(BASE_DELAY_MS * 2 ** this.retryCount, MAX_DELAY_MS);
        this.retryCount += 1;
        this.retryTimer = setTimeout(() => this.open(), delay);
      }
    };

    ws.onerror = () => {
      // onclose trata a reconexão; aqui só garantimos o fechamento.
      ws.close();
    };
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private setStatus(status: WsStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

export const wsClient = new WsClient();
export { NOTIFY_CHANNELS };
