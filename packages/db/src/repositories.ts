import { and, asc, count, desc, eq, gte, sql as dsql } from 'drizzle-orm';

import { db } from './client.js';
import {
  connectionState,
  detections,
  keywords,
  monitoredGroups,
  users,
  whatsappGroups,
} from './schema.js';

// --- connection_state (linha única id=1, seedada na migration) ---

export async function setConnecting(): Promise<void> {
  await db
    .update(connectionState)
    .set({ status: 'connecting', qr: null, updatedAt: new Date() })
    .where(eq(connectionState.id, 1));
}

export async function setQrCode(qr: string): Promise<void> {
  await db
    .update(connectionState)
    .set({ status: 'qr', qr, updatedAt: new Date() })
    .where(eq(connectionState.id, 1));
}

export async function setConnected(): Promise<void> {
  await db
    .update(connectionState)
    .set({ status: 'connected', qr: null, lastConnectedAt: new Date(), updatedAt: new Date() })
    .where(eq(connectionState.id, 1));
}

export async function setDisconnected(): Promise<void> {
  await db
    .update(connectionState)
    .set({ status: 'disconnected', qr: null, updatedAt: new Date() })
    .where(eq(connectionState.id, 1));
}

/**
 * Marca a Sessão como `exhausted`: o worker esgotou as tentativas de QR e parou,
 * aguardando um reconnect manual (botão "Gerar novo QR" no Painel).
 */
export async function setExhausted(): Promise<void> {
  await db
    .update(connectionState)
    .set({ status: 'exhausted', qr: null, updatedAt: new Date() })
    .where(eq(connectionState.id, 1));
}

export interface ConnectionStateRow {
  status: string;
  qr: string | null;
  lastConnectedAt: Date | null;
  updatedAt: Date;
}

/** Lê a linha única (id=1) do estado da conexão WhatsApp. */
export async function getConnectionState(): Promise<ConnectionStateRow | null> {
  const rows = await db
    .select({
      status: connectionState.status,
      qr: connectionState.qr,
      lastConnectedAt: connectionState.lastConnectedAt,
      updatedAt: connectionState.updatedAt,
    })
    .from(connectionState)
    .where(eq(connectionState.id, 1))
    .limit(1);
  return rows[0] ?? null;
}

// --- whatsapp_groups (cache da lista ao vivo) ---

export interface WhatsappGroupInput {
  jid: string;
  name: string;
  participantCount: number | null;
}

export async function upsertWhatsappGroups(groups: WhatsappGroupInput[]): Promise<void> {
  if (groups.length === 0) return;
  await db
    .insert(whatsappGroups)
    .values(groups.map((g) => ({ ...g, updatedAt: new Date() })))
    .onConflictDoUpdate({
      target: whatsappGroups.jid,
      set: {
        name: dsql`excluded.name`,
        participantCount: dsql`excluded.participant_count`,
        updatedAt: new Date(),
      },
    });
}

export interface WhatsappGroupRow {
  jid: string;
  name: string;
  participantCount: number | null;
  updatedAt: Date;
}

/** Lista o cache da lista ao vivo de grupos do WhatsApp (ordenado por nome). */
export async function listWhatsappGroups(): Promise<WhatsappGroupRow[]> {
  return db
    .select({
      jid: whatsappGroups.jid,
      name: whatsappGroups.name,
      participantCount: whatsappGroups.participantCount,
      updatedAt: whatsappGroups.updatedAt,
    })
    .from(whatsappGroups)
    .orderBy(asc(whatsappGroups.name));
}

// --- monitored_groups + keywords (para o filtro por JID) ---

export interface MonitoredGroupWithKeywords {
  jid: string;
  name: string;
  enabled: boolean;
  keywords: string[];
}

export async function listMonitoredGroupsWithKeywords(): Promise<MonitoredGroupWithKeywords[]> {
  const rows = await db
    .select({
      jid: monitoredGroups.jid,
      name: monitoredGroups.name,
      enabled: monitoredGroups.enabled,
      term: keywords.term,
    })
    .from(monitoredGroups)
    .leftJoin(keywords, eq(keywords.monitoredGroupId, monitoredGroups.id));

  const byJid = new Map<string, MonitoredGroupWithKeywords>();
  for (const row of rows) {
    let group = byJid.get(row.jid);
    if (!group) {
      group = { jid: row.jid, name: row.name, enabled: row.enabled, keywords: [] };
      byJid.set(row.jid, group);
    }
    if (row.term) group.keywords.push(row.term);
  }
  return [...byJid.values()];
}

/** Grupo Monitorado completo (com keywords e ids), para a UI/API. */
export interface MonitoredGroupRow {
  id: string;
  jid: string;
  name: string;
  enabled: boolean;
  createdAt: Date;
  keywords: { id: string; monitoredGroupId: string; term: string; createdAt: Date }[];
}

/** Lista os Grupos Monitorados com suas Palavras-chave (incluindo ids), para a API. */
export async function listMonitoredGroups(): Promise<MonitoredGroupRow[]> {
  const rows = await db
    .select({
      id: monitoredGroups.id,
      jid: monitoredGroups.jid,
      name: monitoredGroups.name,
      enabled: monitoredGroups.enabled,
      createdAt: monitoredGroups.createdAt,
      keywordId: keywords.id,
      keywordTerm: keywords.term,
      keywordCreatedAt: keywords.createdAt,
    })
    .from(monitoredGroups)
    .leftJoin(keywords, eq(keywords.monitoredGroupId, monitoredGroups.id))
    .orderBy(asc(monitoredGroups.createdAt), asc(keywords.createdAt));

  const byId = new Map<string, MonitoredGroupRow>();
  for (const row of rows) {
    let group = byId.get(row.id);
    if (!group) {
      group = {
        id: row.id,
        jid: row.jid,
        name: row.name,
        enabled: row.enabled,
        createdAt: row.createdAt,
        keywords: [],
      };
      byId.set(row.id, group);
    }
    if (row.keywordId && row.keywordTerm && row.keywordCreatedAt) {
      group.keywords.push({
        id: row.keywordId,
        monitoredGroupId: row.id,
        term: row.keywordTerm,
        createdAt: row.keywordCreatedAt,
      });
    }
  }
  return [...byId.values()];
}

/** Busca UM Grupo Monitorado por id (com suas keywords), consulta escopada. */
export async function getMonitoredGroupById(id: string): Promise<MonitoredGroupRow | null> {
  const rows = await db
    .select({
      id: monitoredGroups.id,
      jid: monitoredGroups.jid,
      name: monitoredGroups.name,
      enabled: monitoredGroups.enabled,
      createdAt: monitoredGroups.createdAt,
      keywordId: keywords.id,
      keywordTerm: keywords.term,
      keywordCreatedAt: keywords.createdAt,
    })
    .from(monitoredGroups)
    .leftJoin(keywords, eq(keywords.monitoredGroupId, monitoredGroups.id))
    .where(eq(monitoredGroups.id, id))
    .orderBy(asc(keywords.createdAt));

  const first = rows[0];
  if (!first) return null;

  const group: MonitoredGroupRow = {
    id: first.id,
    jid: first.jid,
    name: first.name,
    enabled: first.enabled,
    createdAt: first.createdAt,
    keywords: [],
  };
  for (const row of rows) {
    if (row.keywordId && row.keywordTerm && row.keywordCreatedAt) {
      group.keywords.push({
        id: row.keywordId,
        monitoredGroupId: row.id,
        term: row.keywordTerm,
        createdAt: row.keywordCreatedAt,
      });
    }
  }
  return group;
}

export interface CreateMonitoredGroupArgs {
  jid: string;
  name: string;
  keywords?: string[];
}

/** Cria um Grupo Monitorado (por JID) com suas Palavras-chave iniciais. */
export async function createMonitoredGroup(
  args: CreateMonitoredGroupArgs,
): Promise<MonitoredGroupRow> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(monitoredGroups)
      .values({ jid: args.jid, name: args.name })
      .returning({ id: monitoredGroups.id });
    const group = inserted[0];
    if (!group) throw new Error('falha ao criar grupo monitorado');

    const terms = [...new Set((args.keywords ?? []).map((t) => t.trim()).filter(Boolean))];
    if (terms.length > 0) {
      await tx
        .insert(keywords)
        .values(terms.map((term) => ({ monitoredGroupId: group.id, term })));
    }
    return group.id;
  }).then(async (id) => {
    const created = await getMonitoredGroupById(id);
    if (!created) throw new Error('grupo monitorado não encontrado após criação');
    return created;
  });
}

/** Liga/desliga um Grupo Monitorado. Retorna o grupo atualizado (ou null se inexistente). */
export async function setMonitoredGroupEnabled(
  id: string,
  enabled: boolean,
): Promise<MonitoredGroupRow | null> {
  const updated = await db
    .update(monitoredGroups)
    .set({ enabled })
    .where(eq(monitoredGroups.id, id))
    .returning({ id: monitoredGroups.id });
  if (updated.length === 0) return null;
  return getMonitoredGroupById(id);
}

/** Remove um Grupo Monitorado (keywords caem em cascata). Retorna true se removeu. */
export async function deleteMonitoredGroup(id: string): Promise<boolean> {
  const removed = await db
    .delete(monitoredGroups)
    .where(eq(monitoredGroups.id, id))
    .returning({ id: monitoredGroups.id });
  return removed.length > 0;
}

export interface KeywordRow {
  id: string;
  monitoredGroupId: string;
  term: string;
  createdAt: Date;
}

/** Adiciona uma Palavra-chave a um Grupo Monitorado. Retorna null se o grupo não existe. */
export async function addKeyword(
  monitoredGroupId: string,
  term: string,
): Promise<KeywordRow | null> {
  const group = await db
    .select({ id: monitoredGroups.id })
    .from(monitoredGroups)
    .where(eq(monitoredGroups.id, monitoredGroupId))
    .limit(1);
  if (group.length === 0) return null;

  const inserted = await db
    .insert(keywords)
    .values({ monitoredGroupId, term: term.trim() })
    .onConflictDoNothing({ target: [keywords.monitoredGroupId, keywords.term] })
    .returning();
  const row = inserted[0];
  if (row) return row;

  // já existia (conflito): retorna a existente
  const existing = await db
    .select()
    .from(keywords)
    .where(and(eq(keywords.monitoredGroupId, monitoredGroupId), eq(keywords.term, term.trim())))
    .limit(1);
  return existing[0] ?? null;
}

/** Remove uma Palavra-chave por id. Retorna true se removeu. */
export async function deleteKeyword(id: string): Promise<boolean> {
  const removed = await db
    .delete(keywords)
    .where(eq(keywords.id, id))
    .returning({ id: keywords.id });
  return removed.length > 0;
}

// --- detections ---

export interface DetectionInput {
  groupJid: string;
  groupName: string | null;
  sender: string | null;
  messageText: string;
  matchedKeywords: string[];
  messageId: string | null;
}

export async function insertDetection(input: DetectionInput): Promise<string> {
  const rows = await db.insert(detections).values(input).returning({ id: detections.id });
  const row = rows[0];
  if (!row) throw new Error('falha ao inserir detecção');
  return row.id;
}

export async function markDetectionNotified(id: string): Promise<void> {
  await db.update(detections).set({ notifiedTelegram: true }).where(eq(detections.id, id));
}

export interface DetectionRow {
  id: string;
  groupJid: string;
  groupName: string | null;
  sender: string | null;
  messageText: string;
  matchedKeywords: string[];
  messageId: string | null;
  detectedAt: Date;
  notifiedTelegram: boolean;
}

export interface ListDetectionsFilters {
  limit?: number;
  offset?: number;
  groupJid?: string;
  keyword?: string;
  since?: Date;
}

export interface ListDetectionsResult {
  items: DetectionRow[];
  total: number;
  limit: number;
  offset: number;
}

/** Lista Detecções paginadas com filtros opcionais (grupo, keyword, data). */
export async function listDetections(
  filters: ListDetectionsFilters = {},
): Promise<ListDetectionsResult> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const conditions = [];
  if (filters.groupJid) conditions.push(eq(detections.groupJid, filters.groupJid));
  if (filters.since) conditions.push(gte(detections.detectedAt, filters.since));
  if (filters.keyword) {
    // matchedKeywords é text[]; usa o operador de contains do Postgres.
    conditions.push(dsql`${detections.matchedKeywords} @> ARRAY[${filters.keyword}]::text[]`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(detections)
    .where(where)
    .orderBy(desc(detections.detectedAt))
    .limit(limit)
    .offset(offset);

  const totalRows = await db
    .select({ value: count() })
    .from(detections)
    .where(where);
  const total = totalRows[0]?.value ?? 0;

  return { items, total, limit, offset };
}

export interface StatsResult {
  totalDetections: number;
  perGroup: { groupJid: string; groupName: string | null; count: number }[];
  topKeywords: { keyword: string; count: number }[];
}

/** Estatísticas: total de Detecções, contagem por grupo e top Palavras-chave. */
export async function getStats(): Promise<StatsResult> {
  const totalRows = await db.select({ value: count() }).from(detections);
  const totalDetections = totalRows[0]?.value ?? 0;

  const perGroup = await db
    .select({
      groupJid: detections.groupJid,
      groupName: dsql<string | null>`max(${detections.groupName})`,
      count: count(),
    })
    .from(detections)
    .groupBy(detections.groupJid)
    .orderBy(desc(count()));

  const topKeywordsRows = await db
    .select({
      keyword: dsql<string>`kw`,
      count: dsql<number>`count(*)::int`,
    })
    .from(dsql`${detections}, unnest(${detections.matchedKeywords}) AS kw`)
    .groupBy(dsql`kw`)
    .orderBy(dsql`count(*) DESC`)
    .limit(20);

  return {
    totalDetections,
    perGroup: perGroup.map((g) => ({
      groupJid: g.groupJid,
      groupName: g.groupName,
      count: g.count,
    })),
    topKeywords: topKeywordsRows.map((k) => ({ keyword: k.keyword, count: Number(k.count) })),
  };
}

// --- users (single-user; ADR-0005) ---

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface UpsertUserArgs {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
}

/** Upsert do Usuário por e-mail (a allowlist é checada ANTES, na camada da API). */
export async function upsertUser(args: UpsertUserArgs): Promise<UserRow> {
  const email = args.email.toLowerCase();
  const rows = await db
    .insert(users)
    .values({ email, name: args.name ?? null, avatarUrl: args.avatarUrl ?? null })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: args.name ?? null, avatarUrl: args.avatarUrl ?? null },
    })
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    });
  const row = rows[0];
  if (!row) throw new Error('falha ao fazer upsert do usuário');
  return row;
}

/** Busca um Usuário por id. */
export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}
