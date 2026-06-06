import {
  boolean,
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

/** Lista ao vivo de grupos do WhatsApp (upsert pelo worker; identidade por JID). */
export const whatsappGroups = pgTable('whatsapp_groups', {
  jid: text('jid').primaryKey(),
  name: text('name').notNull(),
  participantCount: integer('participant_count'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Grupo Monitorado: um grupo (por JID) que o usuário acompanha. */
export const monitoredGroups = pgTable('monitored_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  jid: text('jid')
    .notNull()
    .unique()
    .references(() => whatsappGroups.jid, { onDelete: 'cascade' }),
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

/** Detecção: evento de casamento de uma mensagem com uma keyword do grupo. */
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

/** Estado da conexão WhatsApp (linha única id=1, escrita pelo worker). */
export const connectionState = pgTable('connection_state', {
  id: integer('id').primaryKey().default(1),
  status: text('status').notNull().default('disconnected'),
  qr: text('qr'),
  lastConnectedAt: timestamp('last_connected_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
