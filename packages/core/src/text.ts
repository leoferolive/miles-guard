const DIACRITICS = /[̀-ͯ]/g;

/**
 * Normalização de texto portada do MilesGuard (utils/helpers.js):
 * baixa caixa, decompõe acentos (NFD) e remove diacríticos, depois trim.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(DIACRITICS, '').trim();
}

// ---------------------------------------------------------------------------
// Tipos: subconjunto do proto.IMessage do Baileys de que precisamos para extrair
// texto humano legível. Mantido manualmente (sem depender de @whiskeysockets/baileys
// no core) e propositalmente permissivo — campos opcionais/anuláveis.
// ---------------------------------------------------------------------------

interface WAFutureProof {
  message?: WAMessageContent | null;
}

interface WAContextInfo {
  quotedMessage?: WAMessageContent | null;
}

interface WAMediaLeaf {
  caption?: string | null;
  contextInfo?: WAContextInfo | null;
}

interface WAHydratedTemplate {
  hydratedContentText?: string | null;
  hydratedTitleText?: string | null;
  hydratedFooterText?: string | null;
}

interface WATemplateMessage {
  hydratedTemplate?: WAHydratedTemplate | null;
  hydratedFourRowTemplate?: WAHydratedTemplate | null;
  interactiveMessageTemplate?: WAInteractiveMessage | null;
}

interface WAInteractiveMessage {
  body?: { text?: string | null } | null;
  header?: { title?: string | null; subtitle?: string | null } | null;
  footer?: { text?: string | null } | null;
}

interface WAPoll {
  name?: string | null;
  options?: Array<{ optionName?: string | null } | null> | null;
}

/** Conteúdo de mensagem do Baileys (proto.IMessage) — subconjunto relevante. */
export interface WAMessageContent {
  // --- folhas de texto direto ---
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null; contextInfo?: WAContextInfo | null } | null;
  imageMessage?: WAMediaLeaf | null;
  videoMessage?: WAMediaLeaf | null;
  ptvMessage?: WAMediaLeaf | null;
  documentMessage?:
    | (WAMediaLeaf & { title?: string | null; fileName?: string | null })
    | null;

  // --- formatos de bot / promo ---
  templateMessage?: WATemplateMessage | null;
  highlyStructuredMessage?: { hydratedHsm?: WATemplateMessage | null } | null;
  interactiveMessage?: (WAInteractiveMessage & { contextInfo?: WAContextInfo | null }) | null;
  interactiveResponseMessage?: { body?: { text?: string | null } | null } | null;
  buttonsMessage?:
    | { contentText?: string | null; footerText?: string | null; text?: string | null; contextInfo?: WAContextInfo | null }
    | null;
  buttonsResponseMessage?: { selectedDisplayText?: string | null } | null;
  listMessage?: { title?: string | null; description?: string | null } | null;
  listResponseMessage?: { title?: string | null; description?: string | null } | null;
  templateButtonReplyMessage?: { selectedDisplayText?: string | null } | null;
  productMessage?:
    | { body?: string | null; product?: { title?: string | null; description?: string | null } | null }
    | null;
  pollCreationMessage?: WAPoll | null;
  pollCreationMessageV2?: WAPoll | null;
  pollCreationMessageV3?: WAPoll | null;
  pollCreationMessageV5?: WAPoll | null;
  groupInviteMessage?: { caption?: string | null; groupName?: string | null } | null;
  eventMessage?: { name?: string | null; description?: string | null } | null;

  // --- mensagem citada no topo (paridade com o legado/teste) ---
  quotedMessage?: WAMessageContent | null;

  // --- envelopes (desembrulhados recursivamente) ---
  ephemeralMessage?: WAFutureProof | null;
  viewOnceMessage?: WAFutureProof | null;
  viewOnceMessageV2?: WAFutureProof | null;
  viewOnceMessageV2Extension?: WAFutureProof | null;
  documentWithCaptionMessage?: WAFutureProof | null;
  editedMessage?: WAFutureProof | null;
  deviceSentMessage?: WAFutureProof | null;
  groupMentionedMessage?: WAFutureProof | null;
  botInvokeMessage?: WAFutureProof | null;
  botForwardedMessage?: WAFutureProof | null;
  groupStatusMentionMessage?: WAFutureProof | null;
  associatedChildMessage?: WAFutureProof | null;
  questionMessage?: WAFutureProof | null;
  protocolMessage?: { editedMessage?: WAMessageContent | null } | null;
}

const MAX_UNWRAP_DEPTH = 10;

/** Retorna o primeiro valor não-vazio (ignora `null`/`undefined`/só-espaços). */
function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

/**
 * Desembrulha os envelopes do Baileys (mensagem temporária, view-once, editada,
 * encaminhada por bot, etc.) até chegar no conteúdo real. Muitos grupos têm modo
 * efêmero ligado: a oferta vem SEMPRE dentro de `ephemeralMessage` — sem isto, o
 * texto nunca era extraído e a detecção falhava silenciosamente.
 */
function unwrapEnvelopes(content: WAMessageContent): WAMessageContent {
  let current = content;
  for (let depth = 0; depth < MAX_UNWRAP_DEPTH; depth++) {
    const inner =
      current.ephemeralMessage?.message ??
      current.viewOnceMessage?.message ??
      current.viewOnceMessageV2?.message ??
      current.viewOnceMessageV2Extension?.message ??
      current.documentWithCaptionMessage?.message ??
      current.editedMessage?.message ??
      current.deviceSentMessage?.message ??
      current.groupMentionedMessage?.message ??
      current.botInvokeMessage?.message ??
      current.botForwardedMessage?.message ??
      current.groupStatusMentionMessage?.message ??
      current.associatedChildMessage?.message ??
      current.questionMessage?.message ??
      current.protocolMessage?.editedMessage ??
      null;
    if (!inner) break;
    current = inner;
  }
  return current;
}

function extractInteractive(im: WAInteractiveMessage): string | null {
  return firstNonEmpty(im.body?.text, im.header?.title, im.header?.subtitle, im.footer?.text);
}

function extractTemplate(tpl: WATemplateMessage): string | null {
  const hydrated = tpl.hydratedTemplate ?? tpl.hydratedFourRowTemplate;
  const text = firstNonEmpty(
    hydrated?.hydratedContentText,
    hydrated?.hydratedTitleText,
    hydrated?.hydratedFooterText,
  );
  if (text) return text;
  if (tpl.interactiveMessageTemplate) return extractInteractive(tpl.interactiveMessageTemplate);
  return null;
}

/** Extrai o texto de uma mensagem JÁ desembrulhada (folha), sem recursão de envelope. */
function extractLeaf(c: WAMessageContent): string | null {
  // Texto direto e legendas de mídia (casos mais comuns).
  const direct = firstNonEmpty(
    c.conversation,
    c.extendedTextMessage?.text,
    c.imageMessage?.caption,
    c.videoMessage?.caption,
    c.ptvMessage?.caption,
    c.documentMessage?.caption,
    c.documentMessage?.title,
    c.documentMessage?.fileName,
  );
  if (direct) return direct;

  // Formatos de bot / promo (template, interactive, buttons, list, produto, enquete…).
  if (c.templateMessage) {
    const t = extractTemplate(c.templateMessage);
    if (t) return t;
  }
  if (c.highlyStructuredMessage?.hydratedHsm) {
    const t = extractTemplate(c.highlyStructuredMessage.hydratedHsm);
    if (t) return t;
  }
  if (c.interactiveMessage) {
    const t = extractInteractive(c.interactiveMessage);
    if (t) return t;
  }
  const interactiveResp = firstNonEmpty(c.interactiveResponseMessage?.body?.text);
  if (interactiveResp) return interactiveResp;

  const buttons = firstNonEmpty(
    c.buttonsMessage?.contentText,
    c.buttonsMessage?.text,
    c.buttonsMessage?.footerText,
  );
  if (buttons) return buttons;
  const buttonsResp = firstNonEmpty(c.buttonsResponseMessage?.selectedDisplayText);
  if (buttonsResp) return buttonsResp;

  const list = firstNonEmpty(c.listMessage?.title, c.listMessage?.description);
  if (list) return list;
  const listResp = firstNonEmpty(c.listResponseMessage?.title, c.listResponseMessage?.description);
  if (listResp) return listResp;
  const tplReply = firstNonEmpty(c.templateButtonReplyMessage?.selectedDisplayText);
  if (tplReply) return tplReply;

  const product = firstNonEmpty(
    c.productMessage?.product?.title,
    c.productMessage?.product?.description,
    c.productMessage?.body,
  );
  if (product) return product;

  const poll = c.pollCreationMessage ?? c.pollCreationMessageV2 ?? c.pollCreationMessageV3 ?? c.pollCreationMessageV5;
  if (poll) {
    const options = (poll.options ?? [])
      .map((o) => o?.optionName)
      .filter((o): o is string => typeof o === 'string' && o.trim().length > 0);
    const pollText = [poll.name, ...options].filter(Boolean).join(' ').trim();
    if (pollText.length > 0) return pollText;
  }

  const invite = firstNonEmpty(c.groupInviteMessage?.caption, c.groupInviteMessage?.groupName);
  if (invite) return invite;
  const event = firstNonEmpty(c.eventMessage?.name, c.eventMessage?.description);
  if (event) return event;

  return null;
}

/** Caminhos onde uma mensagem citada (quoted) pode estar no Baileys real. */
function findQuoted(c: WAMessageContent): WAMessageContent | null {
  return (
    c.extendedTextMessage?.contextInfo?.quotedMessage ??
    c.imageMessage?.contextInfo?.quotedMessage ??
    c.videoMessage?.contextInfo?.quotedMessage ??
    c.documentMessage?.contextInfo?.quotedMessage ??
    c.buttonsMessage?.contextInfo?.quotedMessage ??
    c.interactiveMessage?.contextInfo?.quotedMessage ??
    c.quotedMessage ?? // paridade com o legado (quoted no topo)
    null
  );
}

/**
 * Extrai o texto humano legível de uma mensagem do WhatsApp (Baileys).
 *
 * Estratégia: (1) desembrulha envelopes recursivamente (efêmera, view-once,
 * editada, device-sent, encaminhada por bot…); (2) extrai a folha — texto direto,
 * legendas de mídia e formatos de bot/promo (template/interactive/buttons/list/
 * produto/enquete); (3) como último recurso, recursa na mensagem citada (quoted).
 *
 * Retorna `null` quando não há texto humano (áudio, sticker, localização, etc.) —
 * o chamador (worker) registra esse caso (`no_text`) para observabilidade.
 */
export function getMessageText(content: WAMessageContent | null | undefined): string | null {
  if (!content) return null;
  const unwrapped = unwrapEnvelopes(content);

  const direct = extractLeaf(unwrapped);
  if (direct) return direct;

  const quoted = findQuoted(unwrapped);
  if (quoted) return getMessageText(quoted);

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
