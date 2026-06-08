// NOTA ARQUITETURAL: o core é deliberadamente SEM dependência do @whiskeysockets/baileys
// (devDeps só vitest/types). O Baileys até exporta `extractMessageContent`/`getContentType`,
// mas adotá-los aqui acoplaria o domínio à lib de transporte e comprometeria a testabilidade.
// Por isso os tipos `WAMessageContent` e o desembrulho de envelopes são mantidos à mão.

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
// texto humano legível. Propositalmente permissivo — campos opcionais/anuláveis.
// ---------------------------------------------------------------------------

interface WAFutureProof {
  message?: WAMessageContent | null;
}

interface WAMediaLeaf {
  caption?: string | null;
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

interface WANativeFlow {
  buttons?: Array<{ buttonParamsJson?: string | null } | null> | null;
}

interface WAInteractiveMessage {
  body?: { text?: string | null } | null;
  header?: { title?: string | null; subtitle?: string | null } | null;
  footer?: { text?: string | null } | null;
  nativeFlowMessage?: WANativeFlow | null;
  carouselMessage?: { cards?: Array<WAInteractiveMessage | null> | null } | null;
}

interface WAListSection {
  title?: string | null;
  rows?: Array<{ title?: string | null; description?: string | null } | null> | null;
}

interface WAListMessage {
  title?: string | null;
  description?: string | null;
  sections?: Array<WAListSection | null> | null;
}

interface WAButtonsMessage {
  contentText?: string | null;
  footerText?: string | null;
  text?: string | null;
  imageMessage?: WAMediaLeaf | null;
  videoMessage?: WAMediaLeaf | null;
  documentMessage?: WAMediaLeaf | null;
}

interface WAPoll {
  name?: string | null;
  options?: Array<{ optionName?: string | null } | null> | null;
}

/** Conteúdo de mensagem do Baileys (proto.IMessage) — subconjunto relevante. */
export interface WAMessageContent {
  // --- folhas de texto direto ---
  conversation?: string | null;
  extendedTextMessage?: { text?: string | null } | null;
  imageMessage?: WAMediaLeaf | null;
  videoMessage?: WAMediaLeaf | null;
  ptvMessage?: WAMediaLeaf | null;
  documentMessage?: (WAMediaLeaf & { title?: string | null }) | null;

  // --- formatos de bot / promo ---
  templateMessage?: WATemplateMessage | null;
  highlyStructuredMessage?: { hydratedHsm?: WATemplateMessage | null } | null;
  interactiveMessage?: WAInteractiveMessage | null;
  interactiveResponseMessage?: { body?: { text?: string | null } | null } | null;
  buttonsMessage?: WAButtonsMessage | null;
  buttonsResponseMessage?: { selectedDisplayText?: string | null } | null;
  listMessage?: WAListMessage | null;
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
  // protocolMessage.editedMessage é proto.IMessage DIRETO (não IFutureProofMessage).
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

/** Junta partes não-vazias num único texto (para listas/enquetes/carrossel). */
function joinNonEmpty(parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  const joined = kept.join(' ').trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Desembrulha os envelopes do Baileys (mensagem temporária, view-once, editada,
 * encaminhada por bot, etc.) até chegar no conteúdo real. Muitos grupos têm modo
 * efêmero ligado: a oferta vem SEMPRE dentro de `ephemeralMessage` — sem isto, o
 * texto nunca era extraído e a detecção falhava silenciosamente. Guarda de
 * profundidade protege contra envelope cíclico/adversarial (não recorre — itera).
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

/** Texto humano de uma nativeFlow (carrossel/CTA): `display_text` no buttonParamsJson. */
function extractNativeFlow(flow: WANativeFlow | null | undefined): string | null {
  const texts: string[] = [];
  for (const button of flow?.buttons ?? []) {
    const raw = button?.buttonParamsJson;
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Primeiro candidato não-vazio (display_text vazio não deve mascarar title/text).
      const dt = firstNonEmpty(
        typeof parsed.display_text === 'string' ? parsed.display_text : null,
        typeof parsed.title === 'string' ? parsed.title : null,
        typeof parsed.text === 'string' ? parsed.text : null,
      );
      if (dt) texts.push(dt);
    } catch {
      /* JSON inválido — ignora este botão */
    }
  }
  return joinNonEmpty(texts);
}

function extractInteractiveDirect(im: WAInteractiveMessage): string | null {
  return firstNonEmpty(
    im.body?.text,
    im.header?.title,
    im.header?.subtitle,
    im.footer?.text,
    extractNativeFlow(im.nativeFlowMessage),
  );
}

function extractInteractive(im: WAInteractiveMessage): string | null {
  const main = extractInteractiveDirect(im);
  if (main) return main;
  // Carrossel: cada card é uma interactive; varre um nível (não recursa em carrossel
  // aninhado — protobuf do fio é acíclico, mas mantemos sem recursão por segurança).
  for (const card of im.carouselMessage?.cards ?? []) {
    if (!card) continue;
    const t = extractInteractiveDirect(card);
    if (t) return t;
  }
  return null;
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

function extractList(lm: WAListMessage): string | null {
  const parts: Array<string | null | undefined> = [lm.title, lm.description];
  for (const section of lm.sections ?? []) {
    parts.push(section?.title);
    for (const row of section?.rows ?? []) {
      parts.push(row?.title, row?.description);
    }
  }
  return joinNonEmpty(parts);
}

/**
 * Extrai o texto humano legível de uma mensagem do WhatsApp (Baileys).
 *
 * Estratégia: (1) desembrulha envelopes recursivamente (efêmera, view-once,
 * editada, device-sent, encaminhada por bot…); (2) extrai a folha — texto direto,
 * legendas de mídia e formatos de bot/promo (template/interactive/nativeFlow/
 * buttons/list/produto/enquete).
 *
 * NÃO extrai texto de mensagem citada (quoted): citar uma oferta não é repostá-la,
 * e usar o quoted como única fonte gerava detecção duplicada com sender/timestamp
 * errados (a resposta, não a oferta original). A detecção considera só o texto
 * próprio da mensagem.
 *
 * Retorna `null` quando não há texto humano (áudio, sticker, localização, etc.) —
 * o chamador (worker) registra esse caso (`no_text`) para observabilidade.
 */
export function getMessageText(content: WAMessageContent | null | undefined): string | null {
  if (!content) return null;
  const c = unwrapEnvelopes(content);

  // Texto direto e legendas de mídia (casos mais comuns).
  const direct = firstNonEmpty(
    c.conversation,
    c.extendedTextMessage?.text,
    c.imageMessage?.caption,
    c.videoMessage?.caption,
    c.ptvMessage?.caption,
    c.documentMessage?.caption,
    c.documentMessage?.title,
  );
  if (direct) return direct;

  // Formatos de bot / promo.
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

  if (c.buttonsMessage) {
    const buttons = firstNonEmpty(
      c.buttonsMessage.contentText,
      c.buttonsMessage.text,
      c.buttonsMessage.footerText,
      c.buttonsMessage.imageMessage?.caption,
      c.buttonsMessage.videoMessage?.caption,
      c.buttonsMessage.documentMessage?.caption,
    );
    if (buttons) return buttons;
  }
  const buttonsResp = firstNonEmpty(c.buttonsResponseMessage?.selectedDisplayText);
  if (buttonsResp) return buttonsResp;

  if (c.listMessage) {
    const list = extractList(c.listMessage);
    if (list) return list;
  }
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
    const options = (poll.options ?? []).map((o) => o?.optionName);
    const pollText = joinNonEmpty([poll.name, ...options]);
    if (pollText) return pollText;
  }

  const invite = firstNonEmpty(c.groupInviteMessage?.caption, c.groupInviteMessage?.groupName);
  if (invite) return invite;
  const event = firstNonEmpty(c.eventMessage?.name, c.eventMessage?.description);
  if (event) return event;

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
