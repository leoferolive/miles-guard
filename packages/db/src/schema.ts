import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Usuário (single-user; ADR-0005). Existe a tabela, mas a allowlist limita o login. */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cache da lista ao vivo de grupos do WhatsApp (upsert pelo worker; identidade por JID).
 * É um CACHE da consulta ao Baileys — não é fonte de verdade. Por isso `monitored_groups`
 * NÃO tem FK para cá (um fetch incompleto não pode apagar a config do usuário).
 */
export const whatsappGroups = pgTable('whatsapp_groups', {
  jid: text('jid').primaryKey(),
  name: text('name').notNull(),
  participantCount: integer('participant_count'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Grupo Monitorado: um grupo (por JID) que o usuário acompanha. Intenção DURÁVEL.
 * Guarda um snapshot de `name` para a UI/detecção não dependerem do cache acima.
 */
export const monitoredGroups = pgTable('monitored_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  jid: text('jid').notNull().unique(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Palavra-chave: pertence a UM Grupo Monitorado (não há lista global). */
export const keywords = pgTable(
  'keywords',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitoredGroupId: uuid('monitored_group_id')
      .notNull()
      .references(() => monitoredGroups.id, { onDelete: 'cascade' }),
    term: text('term').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('keywords_group_term_uq').on(t.monitoredGroupId, t.term)],
);

/** Detecção: evento de casamento (append-only). Denormaliza grupo p/ sobreviver à remoção. */
export const detections = pgTable(
  'detections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupJid: text('group_jid').notNull(),
    groupName: text('group_name'),
    sender: text('sender'),
    messageText: text('message_text').notNull(),
    matchedKeywords: text('matched_keywords').array().notNull(),
    messageId: text('message_id'),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    notifiedTelegram: boolean('notified_telegram').notNull().default(false),
  },
  (t) => [
    index('detections_detected_at_idx').on(t.detectedAt),
    index('detections_group_jid_idx').on(t.groupJid),
  ],
);

/**
 * Estado da conexão WhatsApp — LINHA ÚNICA (id=1), escrita pelo worker via upsert.
 * O CHECK garante o invariante de singleton no banco; a migration semeia a linha 1.
 */
export const connectionState = pgTable(
  'connection_state',
  {
    id: integer('id').primaryKey().default(1),
    status: text('status').notNull().default('disconnected'),
    qr: text('qr'),
    lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('connection_state_singleton', sql`${t.id} = 1`)],
);
