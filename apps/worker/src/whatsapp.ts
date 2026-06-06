import { mkdir, rm } from 'node:fs/promises';

import {
  createMessageFingerprint,
  getMessageText,
  matchKeywords,
  type WAMessageContent,
} from '@nossoradar/core';
import {
  insertDetection,
  listMonitoredGroupsWithKeywords,
  markDetectionNotified,
  notify,
  setConnected,
  setConnecting,
  setDisconnected,
  setQrCode,
  upsertWhatsappGroups,
} from '@nossoradar/db';
import { NOTIFY_CHANNELS } from '@nossoradar/shared';
import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
  type BaileysEventMap,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';

import { env } from './env.js';
import { detectionsCounter, setWhatsappConnectionState } from './metrics.js';
import { formatDetectionAlert, TelegramNotifier } from './telegram.js';

interface MonitoredGroup {
  jid: string;
  name: string;
  enabled: boolean;
  keywords: string[];
}

/**
 * Worker WhatsApp (singleton — ADR-0004). Mantém UMA conexão Baileys, aplica o filtro
 * por JID e grava Detecções no Postgres, notificando via LISTEN/NOTIFY e Telegram.
 *
 * Invariante de singleton em processo: cada `connect()` derruba o socket anterior
 * (`teardownSocket`) e usa um contador de geração para ignorar eventos de sockets
 * obsoletos — evitando duas conexões Baileys simultâneas na mesma conta.
 */
export class WhatsAppWorker {
  private sock: WASocket | null = null;
  private generation = 0;
  private monitored = new Map<string, MonitoredGroup>();
  private readonly dedup = new Map<string, number>();
  private readonly telegram = new TelegramNotifier();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor() {
    setInterval(() => this.pruneDedup(), 30 * 60 * 1000).unref();
  }

  /** (Re)carrega os Grupos Monitorados + keywords do banco para a memória. */
  async reloadConfig(): Promise<void> {
    const groups = await listMonitoredGroupsWithKeywords();
    this.monitored = new Map(groups.filter((g) => g.enabled).map((g) => [g.jid, g]));
    console.log(`[worker] config recarregada: ${this.monitored.size} grupo(s) monitorado(s).`);
  }

  async connect(): Promise<void> {
    this.teardownSocket();
    const gen = ++this.generation;

    await mkdir(env.WA_SESSION_PATH, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(env.WA_SESSION_PATH);

    await setConnecting();
    setWhatsappConnectionState('connecting');
    await notify(NOTIFY_CHANNELS.connectionState);

    const { version } = await fetchLatestBaileysVersion();
    console.log(`[worker] usando WhatsApp Web v${version.join('.')}`);

    const sock = makeWASocket({
      version,
      auth: state,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
    });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
      if (gen === this.generation) void this.onConnectionUpdate(u);
    });
    sock.ev.on('messages.upsert', (u) => {
      if (gen === this.generation) void this.onMessages(u);
    });
  }

  /** Sincroniza a lista ao vivo de grupos para o cache `whatsapp_groups` (seleção por JID). */
  async refreshGroups(): Promise<void> {
    if (!this.sock) return;
    try {
      const data = await this.sock.groupFetchAllParticipating();
      const groups = Object.values(data).map((g) => ({
        jid: g.id,
        name: g.subject || g.id,
        participantCount: g.participants?.length ?? null,
      }));
      await upsertWhatsappGroups(groups);
      await notify(NOTIFY_CHANNELS.groupsRefreshed);
      console.log(`[worker] ${groups.length} grupo(s) sincronizado(s).`);
    } catch (err) {
      console.error('[worker] falha ao buscar grupos:', err);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.teardownSocket();
    this.telegram.stop();
  }

  /** Encerra o socket atual e descarta seus listeners (ADR-0004: nunca dois sockets). */
  private teardownSocket(): void {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        /* já encerrado */
      }
      this.sock = null;
    }
  }

  private scheduleReconnect(delayMs: number): void {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  private async clearSession(): Promise<void> {
    await rm(env.WA_SESSION_PATH, { recursive: true, force: true });
    await mkdir(env.WA_SESSION_PATH, { recursive: true });
  }

  private async onConnectionUpdate(update: BaileysEventMap['connection.update']): Promise<void> {
    try {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        await setQrCode(qr);
        setWhatsappConnectionState('qr');
        await notify(NOTIFY_CHANNELS.connectionState);
        console.log('[worker] QR atualizado — pareie pelo painel.');
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0;
        await setConnected();
        setWhatsappConnectionState('connected');
        await notify(NOTIFY_CHANNELS.connectionState);
        console.log('[worker] conectado ao WhatsApp.');
        setTimeout(() => {
          void this.refreshGroups();
        }, 2_000);
        return;
      }

      if (connection === 'close') {
        await setDisconnected();
        setWhatsappConnectionState('disconnected');
        await notify(NOTIFY_CHANNELS.connectionState);

        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        console.log(`[worker] conexão fechada (statusCode=${statusCode ?? 'n/a'}).`);

        if (this.stopped) return;

        if (statusCode === DisconnectReason.loggedOut) {
          console.error('[worker] deslogado — limpando a sessão para reparear.');
          await this.clearSession();
          this.reconnectAttempts = 0;
          this.scheduleReconnect(2_000);
          return;
        }

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts += 1;
          const delayMs = Math.min(env.WA_RECONNECT_DELAY * 2 ** (this.reconnectAttempts - 1), 30_000);
          console.log(
            `[worker] reconectando em ${Math.round(delayMs / 1000)}s ` +
              `(tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts}).`,
          );
          this.scheduleReconnect(delayMs);
        } else {
          console.error('[worker] máximo de tentativas de reconexão atingido.');
        }
      }
    } catch (err) {
      console.error('[worker] erro no connection.update:', err);
    }
  }

  private async onMessages(update: BaileysEventMap['messages.upsert']): Promise<void> {
    for (const message of update.messages) {
      try {
        await this.handleMessage(message);
      } catch (err) {
        console.error('[worker] erro ao processar mensagem:', err);
      }
    }
  }

  private async handleMessage(message: WAMessage): Promise<void> {
    const jid = message.key?.remoteJid;
    if (!jid || !jid.endsWith('@g.us') || !message.message) return;

    const monitored = this.monitored.get(jid);
    if (!monitored) return; // grupo não monitorado

    const text = getMessageText(message.message as unknown as WAMessageContent);
    if (!text || text.trim().length === 0) return;

    const participant = message.key?.participant
      ? message.key.participant.split('@')[0]
      : undefined;
    const sender = message.pushName ?? participant ?? null;

    const tsRaw = message.messageTimestamp;
    const ts = tsRaw ? Number(tsRaw.toString()) : Math.floor(Date.now() / 1000);

    const fingerprint = createMessageFingerprint(sender ?? 'desconhecido', text, ts);
    if (fingerprint) {
      if (this.dedup.has(fingerprint)) return;
      this.dedup.set(fingerprint, Date.now());
    }

    const matched = matchKeywords(text, monitored.keywords);
    if (matched.length === 0) return;

    const detectionId = await insertDetection({
      groupJid: jid,
      groupName: monitored.name,
      sender,
      messageText: text,
      matchedKeywords: matched,
      messageId: message.key?.id ?? null,
    });
    await notify(NOTIFY_CHANNELS.detectionCreated, detectionId);
    detectionsCounter.inc({ group_jid: jid });

    // `notified_telegram` só vira true quando o envio confirma (onSent). Se o Telegram
    // estiver desabilitado, fica false (= não confirmado), por design.
    const time = new Date(ts * 1000).toLocaleTimeString('pt-BR');
    this.telegram.enqueue(
      formatDetectionAlert({ groupName: monitored.name, sender, text, matchedKeywords: matched, time }),
      () => {
        void markDetectionNotified(detectionId);
      },
    );

    console.log(`[worker] detecção em "${monitored.name}": ${matched.join(', ')}`);
  }

  private pruneDedup(): void {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [fingerprint, ts] of this.dedup) {
      if (ts < cutoff) this.dedup.delete(fingerprint);
    }
  }
}
