import type { PriceInsight } from '@nossoradar/core';

import { env } from './env.js';

interface QueueItem {
  text: string;
  onSent?: () => void;
  attempts?: number;
}

export interface DetectionAlert {
  groupName: string;
  sender: string | null;
  text: string;
  matchedKeywords: string[];
  time: string;
  /** Preço extraído + comparação com o histórico do produto (insight null = histórico curto). */
  price?: { current: number; insight: PriceInsight | null };
  /** Página do produto no Painel (só quando há produto identificado e PUBLIC_URL). */
  historyUrl?: string;
}

const BRL_INT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL_CENTS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
/** "R$ 1.750" / "R$ 1.709,50" (centavos sempre com 2 casas). */
const formatBRL = (value: number): string =>
  (Number.isInteger(value) ? BRL_INT : BRL_CENTS).format(value);
const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Linhas de histórico de preço do alerta (vazio se não há histórico suficiente). */
function formatPriceInsight(insight: PriceInsight): string {
  const direction =
    insight.deltaPct === 0
      ? 'igual à mediana'
      : `${PCT.format(Math.abs(insight.deltaPct))}% ${insight.deltaPct < 0 ? 'abaixo' : 'acima'}`;
  let text = `📊 *Mediana:* ${formatBRL(insight.median)} (${insight.sampleSize} ofertas) · ${direction}\n`;
  if (insight.badge === 'lowest') text += '🏆 *Menor preço já visto!*\n';
  if (insight.badge === 'among_lowest') text += '📉 *Entre os menores preços*\n';
  return text;
}

const ALERT_TIME_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Data/hora do alerta em horário de Brasília ("10/11 16:11:50"). O fuso é explícito:
 * o container roda em UTC, e sem ele o alerta mostrava a hora 3h adiantada.
 */
export function formatAlertTime(date: Date): string {
  const p = Object.fromEntries(
    ALERT_TIME_FORMAT.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${p.day}/${p.month} ${p.hour}:${p.minute}:${p.second}`;
}

/** Formata o Alerta de Detecção (portado de telegram.service.formatIndividualMessage). */
export function formatDetectionAlert(alert: DetectionAlert): string {
  const tags = alert.matchedKeywords.map((k) => `#${k.replace(/\s+/g, '_')}`).join(' ');
  let text = '🎯 *Oferta detectada*\n\n';
  text += `📱 *Grupo:* ${alert.groupName}\n`;
  if (alert.sender) text += `👤 *De:* ${alert.sender}\n`;
  text += `🕐 *Hora:* ${alert.time}\n`;
  if (alert.matchedKeywords.length > 0) text += `🔍 *Palavras-chave:* ${tags}\n`;
  if (alert.price?.insight) text += formatPriceInsight(alert.price.insight);
  // URL crua (sem [texto](url)): a chave vai percent-encoded e não tem "_" nem "*".
  if (alert.historyUrl) text += `📈 Histórico: ${alert.historyUrl}\n`;
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
  private readonly maxQueue = 500;
  private readonly maxAttempts = 5;
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
    if (this.queue.length >= this.maxQueue) {
      this.queue.shift(); // drop-oldest para não crescer sem limite
      console.warn('[telegram] fila cheia — descartando alerta mais antigo.');
    }
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
      if (ok) {
        item.onSent?.();
      } else {
        // Falha transitória (rede/429/5xx): reenfileira no FIM (deixa outros alertas
        // passarem; o rate-limit entre envios já serve de backoff) até o teto. Sem
        // isto, uma detecção gravada no DB ficava para sempre sem alerta no Telegram.
        const attempts = (item.attempts ?? 0) + 1;
        if (attempts < this.maxAttempts) {
          this.queue.push({ ...item, attempts });
          console.warn(`[telegram] reentregando alerta (tentativa ${attempts}/${this.maxAttempts}).`);
        } else {
          console.error(
            `[telegram] alerta NÃO entregue após ${this.maxAttempts} tentativas — desistindo.`,
          );
        }
      }
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
