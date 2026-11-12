import { normalizeText } from './text.js';

/**
 * Categorias de produto. Vence a que aparece MAIS CEDO no título (ver classifyPart):
 * "Notebook … Core i5 … SSD" é Notebook; "Processador … (Sem Cooler)" é Processador;
 * "Cooler para Processador" é Cooler. A ordem da lista só desempata a mesma posição.
 */
const RULES: { category: string; pattern: RegExp }[] = [
  { category: 'Notebook', pattern: /\b(?:notebook|laptop|chromebook|macbook|ultrabook)\b/ },
  {
    category: 'Smartphone',
    pattern:
      /\b(?:smartphone|celular|iphone|galaxy [asz]\d+|redmi|moto [eg]\d*|poco [fmx]\d|motorola edge|edge \d{2}(?: fusion| pro| neo)?|[as]\d{2}(?: fe| ultra| plus)? 5g)\b/,
  },
  // Linhas de tênis da Nike/Jordan aparecem sem a palavra "tênis" ("Nike Air Max Nuaxis").
  {
    category: 'Calçados',
    pattern:
      /\b(?:tenis|sapatenis|sapato|chuteira|sandalia|chinelo|bota|papete|slide|crocs|air max|air force|dunk|jordan)\b/,
  },
  { category: 'Roupas', pattern: /\b(?:camiseta|camisa|regata|bermuda|shorts?|calca|jaqueta|moletom|agasalho|blusa|meias?|bone|vestido|legging)\b/ },
  { category: 'Bolsas e mochilas', pattern: /\b(?:mochila|bolsa|pochete|necessaire|mala)\b/ },
  { category: 'TV', pattern: /\b(?:smart ?tv|tv|televis(?:or|ao))\b/ },
  { category: 'Monitor', pattern: /\bmonitor\b/ },
  { category: 'Gabinete', pattern: /\bgabinete\b/ },
  { category: 'Placa-mãe', pattern: /\b(?:placa[- ]?mae|motherboard)\b/ },
  { category: 'Placa de vídeo', pattern: /\b(?:placa de video|rtx ?\d{4}|gtx ?\d{3,4}|radeon rx|rx ?\d{4})\b/ },
  { category: 'Processador', pattern: /\b(?:processador|ryzen|\d{4}x3d|core i[3579]|core ultra)\b/ },
  { category: 'Cooler', pattern: /\b(?:cooler|water ?cooler|air ?cooler)\b/ },
  { category: 'Armazenamento', pattern: /\b(?:ssd|hd externo|hdd|nvme|pendrive|pen drive|cartao de memoria|micro ?sd)\b/ },
  { category: 'Barbear e aparar', pattern: /\b(?:oneblade|aparador|barbeador|raspador|laminas? de reposicao)\b/ },
  { category: 'Casa inteligente', pattern: /\b(?:echo dot|echo pop|echo show|alexa|smart plug|lampada inteligente|tomada inteligente)\b/ },
  { category: 'Periféricos', pattern: /\b(?:teclado|mouse|headset|fone de ouvido|webcam)\b/ },
];

/** Categoria quando nenhuma regra casa (nunca null: toda Detecção tem categoria). */
export const OTHER_CATEGORY = 'Outros';
/** "Processador + Placa-mãe": partes de categorias diferentes juntas num anúncio. */
export const KIT_CATEGORY = 'Kit';

/** Todas as categorias possíveis, na ordem de exibição (para filtros no Painel). */
export const PRODUCT_CATEGORIES: readonly string[] = [
  ...RULES.map((r) => r.category),
  KIT_CATEGORY,
  OTHER_CATEGORY,
];

/**
 * A categoria cujo termo aparece MAIS CEDO no título vence: o produto principal vem
 * primeiro e compatibilidade/acessório no fim ("SSD … para Notebook", "Echo Dot …
 * controle sua TV", "OneBlade … com Bolsa") não pode roubar a categoria. Empate na mesma
 * posição → ordem de RULES.
 */
function classifyPart(norm: string): string {
  let best: { index: number; category: string } | null = null;
  for (const rule of RULES) {
    const m = rule.pattern.exec(norm);
    if (m && (best === null || m.index < best.index)) best = { index: m.index, category: rule.category };
  }
  return best?.category ?? OTHER_CATEGORY;
}

/**
 * Classifica o produto pelo TÍTULO (não pelo texto todo: a descrição cita outros produtos,
 * ex.: gabinete "ideal para 5800x3d"). Puro e determinístico.
 */
export function classifyProduct(title: string | null): string {
  if (!title) return OTHER_CATEGORY;
  const norm = normalizeText(title);
  if (/\b(?:kit|combo)\b/.test(norm)) return KIT_CATEGORY;
  // "+" juntando produtos de categorias diferentes = kit. "OneBlade Face + Body" não é:
  // o lado "Body" não tem categoria própria.
  const parts = norm.split('+').map(classifyPart).filter((c) => c !== OTHER_CATEGORY);
  if (new Set(parts).size > 1) return KIT_CATEGORY;
  return classifyPart(norm);
}

/** Regra de uma Palavra-chave: o termo + (opcional) as categorias em que ela vale. */
export interface KeywordRule {
  term: string;
  /** Vazio = vale para qualquer categoria. */
  categories: string[];
}

/**
 * A Palavra-chave vale para esta categoria? Sem restrição → sim. Categoria desconhecida
 * ("Outros") ou **Kit** → sim também: a restrição só corta o que sabidamente é OUTRA
 * coisa, e um kit/combo pode conter o produto procurado ("TV MiniLED + Soundbar").
 * Na dúvida o radar avisa (perder oferta é pior que um alerta a mais).
 */
export function keywordAppliesTo(rule: KeywordRule, category: string): boolean {
  return (
    rule.categories.length === 0 ||
    category === OTHER_CATEGORY ||
    category === KIT_CATEGORY ||
    rule.categories.includes(category)
  );
}
