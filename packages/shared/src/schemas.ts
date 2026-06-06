import { z } from 'zod';

// --- Estado da conexão WhatsApp (singleton, escrito pelo worker) ---
export const connectionStatusSchema = z.enum(['disconnected', 'connecting', 'qr', 'connected']);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const connectionStateSchema = z.object({
  status: connectionStatusSchema,
  qr: z.string().nullable(),
  lastConnectedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type ConnectionState = z.infer<typeof connectionStateSchema>;

// --- Grupo do WhatsApp (lista ao vivo, por JID) ---
export const whatsappGroupSchema = z.object({
  jid: z.string(),
  name: z.string(),
  participantCount: z.number().int().nonnegative().nullable(),
  updatedAt: z.string().datetime(),
});
export type WhatsappGroup = z.infer<typeof whatsappGroupSchema>;

// --- Palavra-chave (pertence a UM Grupo Monitorado) ---
export const keywordSchema = z.object({
  id: z.string().uuid(),
  monitoredGroupId: z.string().uuid(),
  term: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Keyword = z.infer<typeof keywordSchema>;

// --- Grupo Monitorado (por JID, com keywords próprias) ---
export const monitoredGroupSchema = z.object({
  id: z.string().uuid(),
  jid: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  keywords: z.array(keywordSchema),
});
export type MonitoredGroup = z.infer<typeof monitoredGroupSchema>;

// --- Detecção (evento de casamento) ---
export const detectionSchema = z.object({
  id: z.string().uuid(),
  groupJid: z.string(),
  groupName: z.string().nullable(),
  sender: z.string().nullable(),
  messageText: z.string(),
  matchedKeywords: z.array(z.string()),
  messageId: z.string().nullable(),
  detectedAt: z.string().datetime(),
  notifiedTelegram: z.boolean(),
});
export type Detection = z.infer<typeof detectionSchema>;

// --- Usuário autenticado (single-user; ADR-0005) ---
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

// --- Contratos de entrada da API ---
export const createMonitoredGroupInput = z.object({
  jid: z.string().min(1),
  keywords: z.array(z.string().min(1)).default([]),
});
export type CreateMonitoredGroupInput = z.infer<typeof createMonitoredGroupInput>;

export const addKeywordInput = z.object({
  term: z.string().min(1),
});
export type AddKeywordInput = z.infer<typeof addKeywordInput>;
