/** Mínimo de ofertas anteriores para mostrar a mediana. */
export const MIN_SAMPLES_FOR_MEDIAN = 3;
/** Mínimo de ofertas anteriores para marcar "menor preço" / "entre os menores". */
export const MIN_SAMPLES_FOR_BADGE = 5;
/** "Entre os menores" = até o percentil 20 dos preços anteriores. */
const AMONG_LOWEST_PERCENTILE = 0.2;

export type PriceBadge = 'lowest' | 'among_lowest';

export interface PriceInsight {
  median: number;
  /** Quantas ofertas anteriores entraram na conta. */
  sampleSize: number;
  /** Diferença do preço atual para a mediana, em % (negativo = abaixo). 1 casa decimal. */
  deltaPct: number;
  badge: PriceBadge | null;
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
}

/**
 * Compara o preço atual com as ofertas ANTERIORES do mesmo produto (já sem repostagens,
 * ver getPreviousPrices). Retorna null quando o histórico é curto demais para dizer algo.
 */
export function priceInsight(current: number, previous: number[]): PriceInsight | null {
  if (previous.length < MIN_SAMPLES_FOR_MEDIAN) return null;

  const med = median(previous);
  const deltaPct = Math.round(((current - med) / med) * 1000) / 10;

  let badge: PriceBadge | null = null;
  if (previous.length >= MIN_SAMPLES_FOR_BADGE) {
    const sorted = [...previous].sort((a, b) => a - b);
    const min = sorted[0] ?? Infinity;
    const p20 = sorted[Math.max(0, Math.ceil(sorted.length * AMONG_LOWEST_PERCENTILE) - 1)] ?? -Infinity;
    if (current < min) badge = 'lowest';
    else if (current <= p20) badge = 'among_lowest';
  }

  return { median: med, sampleSize: previous.length, deltaPct, badge };
}
