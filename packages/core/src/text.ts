const DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalização de texto portada do MilesGuard (utils/helpers.js):
 * baixa caixa, decompõe acentos (NFD) e remove diacríticos, depois trim.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(DIACRITICS, '').trim();
}

/** Subconjunto do conteúdo de mensagem do Baileys de que precisamos. */
export interface WAMessageContent {
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null } | null;
  imageMessage?: { caption?: string | null } | null;
  videoMessage?: { caption?: string | null } | null;
  documentMessage?: { caption?: string | null } | null;
  // Paridade com o legado: mensagens citadas. TODO(Fase 2): no Baileys real o
  // quoted vive em extendedTextMessage.contextInfo.quotedMessage — mapear lá.
  quotedMessage?: WAMessageContent | null;
}

/** Extrai o texto relevante de uma mensagem (texto, legenda de mídia, citada). */
export function getMessageText(content: WAMessageContent | null | undefined): string | null {
  if (!content) return null;
  if (content.conversation) return content.conversation;
  if (content.extendedTextMessage?.text) return content.extendedTextMessage.text;
  if (content.imageMessage?.caption) return content.imageMessage.caption;
  if (content.videoMessage?.caption) return content.videoMessage.caption;
  if (content.documentMessage?.caption) return content.documentMessage.caption;
  if (content.quotedMessage) return getMessageText(content.quotedMessage);
  return null;
}

/**
 * Fingerprint para deduplicação (portado): sender + texto + minuto, em base64.
 * Agrupa por minuto para colapsar reenvios quase simultâneos.
 */
export function createMessageFingerprint(
  sender: string,
  text: string,
  timestampSeconds: number,
): string | null {
  if (!text) return null;
  const content = `${sender}-${text}-${Math.floor(timestampSeconds / 60)}`;
  const base64 = Buffer.from(content).toString('base64');
  return base64.substring(0, Math.min(24, base64.length));
}
