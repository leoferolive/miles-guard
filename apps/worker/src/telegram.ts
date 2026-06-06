import { env } from './env.js';

interface QueueItem {
  text: string;
  onSent?: () => void;
}

export interface DetectionAlert {
  groupName: string;
  sender: string | null;
  text: string;
  matchedKeywords: string[];
  time: string;
}

/** Formata o Alerta de Detecção (portado de telegram.service.formatIndividualMessage). */
export function formatDetectionAlert(alert: DetectionAlert): string {
  const tags = alert.matchedKeywords.map((k) => `#${k.replace(/\s+/g, '_')}`).join(' ');
  let text = '🎯 *Oferta detectada*\n\n';
  text += `📱 *Grupo:* ${alert.groupName}\n`;
  if (alert.sender) text += `👤 *De:* ${alert.sender}\n`;
  text += `🕐 *Hora:* ${alert.time}\n`;
  if (alert.matchedKeywords.length > 0) text += `🔍 *Palavras-chave:* ${tags}\n`;
  const body = alert.text.length > 1000 ? `${alert.text.slice(0, 1000)}\n...` : alert.text;
  text += `\n💬 *Mensagem:*\n\`\`\`\n${body}\n\`\`\``;
  return text;
}

/**
 * Cliente Telegram mínimo (fetch) com fila e rate-limit (portado do telegram.service).
 * Destino único (TELEGRAM_CHAT_ID), conforme decisão de domínio.
 */
export class TelegramNotifier {
  private readonly enabled: boolean;
  private readonly queue: QueueItem[] = [];
  private readonly intervalMs: number;
  private lastSent = 0;
  private running = false;

  constructor(
    private readonly token: string = env.TELEGRAM_BOT_TOKEN,
    private readonly chatId: string = env.TELEGRAM_CHAT_ID,
    ratePerMinute = 20,
  ) {
    this.enabled = Boolean(token && chatId);
    this.intervalMs = (60 / ratePerMinute) * 1000;
    if (this.enabled) {
      this.running = true;
      void this.loop();
    } else {
      console.warn('[telegram] sem token/chat_id — alertas no Telegram desabilitados.');
    }
  }

  enqueue(text: string, onSent?: () => void): void {
    if (!this.enabled) return;
    this.queue.push({ text, onSent });
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      const item = this.queue.shift();
      if (!item) {
        await delay(1000);
        continue;
      }
      const wait = this.intervalMs - (Date.now() - this.lastSent);
      if (wait > 0) await delay(wait);
      const ok = await this.send(item.text);
      this.lastSent = Date.now();
      if (ok) item.onSent?.();
    }
  }

  private async send(text: string): Promise<boolean> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) {
        console.error('[telegram] envio falhou:', res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error('[telegram] erro de rede:', err);
      return false;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
