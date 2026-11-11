import { normalizeText } from './text.js';

/**
 * Versão das regras de extração. Ao mudar qualquer heurística abaixo, incremente:
 * o worker reprocessa no boot as detecções gravadas com versão menor (backfill).
 */
export const OFFER_EXTRACTION_VERSION = 1;

export interface OfferInfo {
  /** Linha do produto, sem markdown/emoji (null se não identificada). */
  title: string | null;
  /** Preço final da oferta em reais (null se ausente ou ambíguo). */
  price: number | null;
  /**
   * Identidade do produto para histórico de preço. `c:` = códigos de modelo do título;
   * `w:` = conjunto exato de palavras do título. null = sem confiança (não agrupa).
   * Viés deliberado: na dúvida SEPARA produtos — mediana errada é pior que nenhuma.
   */
  productKey: string | null;
}

const EMPTY: OfferInfo = { title: null, price: null, productKey: null };

/** Valor em BRL: "1.799,00", "1130,68", "1.394", "1768". */
const NUM = String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)`;
const PRICE_EMOJI_LINE = /^\s*(?:💵|💲|💰)/u;
const URL = /https?:\/\/|www\./i;

function parseBRL(raw: string): number {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

/** Remove trechos riscados (~preço antigo~) do WhatsApp. */
function stripStrikethrough(text: string): string {
  return text.replace(/~[^~\n]*~/g, '');
}

/** "De R$ 229 por *R$ 113*" / "DE ~R$ 212~ | POR *124,89*" → valor do "por". */
function porPrices(lines: string[]): number[] {
  const re = new RegExp(String.raw`\bpor\b\s*\*?\s*(?:R\$\s*)?\*?\s*` + NUM, 'i');
  const out: number[] = [];
  for (const line of lines) {
    if (!/\bde\b.*\bpor\b/i.test(line)) continue;
    const m = re.exec(line);
    if (m?.[1]) out.push(parseBRL(m[1]));
  }
  return out;
}

/** Valores "R$ X" que não são desconto ("R$ 100 OFF") nem parcela ("10x de R$ 99"). */
function plainRealAmounts(text: string): number[] {
  const re = new RegExp(String.raw`R\$\s*\*?\s*` + NUM + String.raw`(?!\s*(?:off|de desconto))`, 'gi');
  const out: number[] = [];
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index - 8), m.index);
    if (/\d+\s*x\s*(?:de\s*)?$/i.test(before)) continue;
    if (m[1]) out.push(parseBRL(m[1]));
  }
  return out;
}

function extractPrice(lines: string[], text: string): number | null | 'ambiguous' {
  const por = porPrices(lines);
  if (por.length > 1) return 'ambiguous';
  if (por.length === 1) return por[0] ?? null;

  const emojiLines = lines.filter((l) => PRICE_EMOJI_LINE.test(l));
  if (emojiLines.length > 1) return 'ambiguous';
  if (emojiLines.length === 1) {
    const line = emojiLines[0] ?? '';
    const m =
      new RegExp(String.raw`R\$\s*\*?\s*` + NUM).exec(line) ?? new RegExp(NUM).exec(line);
    return m?.[1] ? parseBRL(m[1]) : null;
  }

  const amounts = [...new Set(plainRealAmounts(text))];
  return amounts.length === 1 ? (amounts[0] ?? null) : null;
}

/** Tira markdown do WhatsApp e emojis/símbolos das pontas. */
function cleanLine(line: string): string {
  return line
    .replace(/[*_~`]/g, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N})"”'%+]+$/u, '')
    .trim();
}

function isNoise(cleaned: string, raw: string): boolean {
  return (
    cleaned.length < 4 ||
    URL.test(raw) ||
    /\bcupo(?:m|ns)\b|\blink\b|\bresgat/i.test(raw) ||
    // Instruções ("Selecione a primeira opção … pelo APP!") não são produto.
    /\b(?:selecione|clique|acesse|aplicativo|app)\b/i.test(raw) ||
    /R\$/.test(raw) ||
    PRICE_EMOJI_LINE.test(raw) ||
    cleaned.split(/\s+/).length < 2
  );
}

/** Token com letra e dígito (5500X3D, QP1425, G5) — indício de modelo. */
const HAS_CODE = /\b(?=[\p{L}\d]*\p{L})(?=[\p{L}\d]*\d)[\p{L}\d]{2,}\b/u;

/**
 * Slogan em CAPS ("ONEBLADE EM PROMO VIROU RARIDADE"). Linha curta em CAPS com código
 * ("RYZEN 5 5500X3D") é produto; longa ("MEU DEUS … AGUENTA ATÉ 5800X3D") é slogan.
 */
function isHype(cleaned: string): boolean {
  if (HAS_CODE.test(cleaned) && cleaned.split(/\s+/).length <= 4) return false;
  const letters = cleaned.replace(/[^\p{L}]/gu, '');
  if (letters.length < 6) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  return upper / letters.length >= 0.8;
}

function extractTitle(lines: string[]): string | null {
  const candidates = lines.map((raw) => ({ raw, cleaned: cleanLine(raw) }));
  const ok = (c: { raw: string; cleaned: string }) => !isNoise(c.cleaned, c.raw) && !isHype(c.cleaned);

  // 1) Promozone / RB Store: "✅ Produto".
  const check = candidates.find((c) => c.raw.trimStart().startsWith('✅') && ok(c));
  if (check) return check.cleaned;
  // 2) Ofcpromo: o produto vem numa linha toda em negrito, depois do slogan.
  const bold = candidates.find((c) => /^\s*\*[^*]+\*\s*$/.test(c.raw) && ok(c));
  if (bold) return bold.cleaned;
  // 3) Linha curta com código de modelo ("RYZEN 5 5500X3D" depois de um aviso). Curta
  //    para não pegar descrição em prosa que cita outro modelo ("segura 9800x3d").
  const first = candidates.find(ok);
  const coded = candidates.find(
    (c) => ok(c) && HAS_CODE.test(c.cleaned) && c.cleaned.split(/\s+/).length <= 10,
  );
  if (coded && first && !HAS_CODE.test(first.cleaned)) {
    // Só troca a 1ª linha se ela própria não tiver código (IURI costuma abrir com o produto).
    return coded.cleaned;
  }
  // 4) IURI e demais: primeira linha "de produto".
  return first?.cleaned ?? null;
}

/** Especificação com unidade (4.5ghz, 96mb, 180hz, 5v, 4k, 1080p...) — não é modelo. */
const UNIT = /^\d+(?:[.,]\d+)?(?:ghz|mhz|gb|mb|tb|hz|ms|w|v|mah|mm|cm|m|k|p|x|bits?)$/;
/** Tokens alfanuméricos genéricos que aparecem em muitos produtos. */
const GENERIC = new Set(['am4', 'am5', 'ddr3', 'ddr4', 'ddr5', 'usb3', 'hdr10', 'wifi6', 'pcie4', 'pcie5', 'x3d', 'rgb']);
/** Abreviação de linha (Ryzen 5 = R5, Core i7) — redundante com o código do modelo. */
const TIERS = new Set(['r3', 'r5', 'r7', 'r9', 'i3', 'i5', 'i7', 'i9']);
/** Tecnologia de tela: diferencia variantes com o mesmo código (Odyssey G5 ≠ Odyssey OLED G5). */
const QUALIFIERS = new Set(['oled', 'qled', 'miniled']);
const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'sem', 'para', 'em', 'a', 'o', 'the']);

function isPartNumber(token: string): boolean {
  return token.includes('-') || (token.match(/\d/g)?.length ?? 0) >= 6 || token.length >= 10;
}

function productKeyFromTitle(title: string): string | null {
  const norm = normalizeText(title)
    .replace(/mini[\s-]?led/g, 'miniled')
    // 27" / 27'' / 27 pol / 27 polegadas → 27pol
    .replace(/(\d+)\s*(?:"|''|”|pol(?:egadas)?\b)/g, '$1pol');
  const tokens = norm
    .split(/[^a-z0-9\-./]+/)
    .flatMap((t) => t.split('/'))
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ''))
    .filter(Boolean);

  const isCode = (t: string) =>
    /\d/.test(t) && /[a-z]/.test(t) && !UNIT.test(t) && !GENERIC.has(t) && !t.endsWith('pol');
  let codes = [...new Set(tokens.filter(isCode))];
  if (codes.some((c) => !isPartNumber(c))) codes = codes.filter((c) => !isPartNumber(c));
  if (codes.some((c) => !TIERS.has(c))) codes = codes.filter((c) => !TIERS.has(c));
  // "65C6K … 65 C6K": um código contido em outro é o mesmo modelo.
  codes = codes.filter((c) => !codes.some((o) => o !== c && o.includes(c)));

  if (codes.length > 0) {
    // Tamanho de tela e tecnologia só qualificam um código de modelo; sozinhos não identificam.
    const sizes = tokens.filter((t) => /^\d+pol$/.test(t));
    const quals = tokens.filter((t) => QUALIFIERS.has(t));
    return `c:${[...new Set([...codes, ...sizes, ...quals])].sort().join('+')}`;
  }

  const words = [...new Set(tokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t)))].sort();
  return words.length >= 3 ? `w:${words.join('+')}` : null;
}

/**
 * Extrai título, preço e identidade do produto de uma oferta (puro, sem I/O).
 * Formatos reais cobertos: IURI (💵), Ofcpromo ("De … por"), Promozone (✅ + "DE ~…~ | POR"),
 * RB Store (✅ + 💲). Mensagem com vários produtos é tratada como ambígua.
 */
export function extractOffer(text: string): OfferInfo {
  if (!text?.trim()) return EMPTY;
  const clean = stripStrikethrough(text);
  const lines = clean.split('\n').filter((l) => l.trim() !== '');

  const price = extractPrice(lines, clean);
  if (price === 'ambiguous') return EMPTY;

  const title = extractTitle(lines);
  return {
    title,
    price: price !== null && price > 0 ? price : null,
    productKey: title ? productKeyFromTitle(title) : null,
  };
}
