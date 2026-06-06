import { eq, sql as dsql } from 'drizzle-orm';

import { db } from './client.js';
import { connectionState, detections, keywords, monitoredGroups, whatsappGroups } from './schema.js';

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
