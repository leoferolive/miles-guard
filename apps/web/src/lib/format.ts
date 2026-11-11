const BRL_INT = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const BRL_CENTS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

/** "R$ 1.701" / "R$ 124,89" / "R$ 3.578,50" (centavos sempre com 2 casas). */
export const formatBRL = (value: number): string =>
  (Number.isInteger(value) ? BRL_INT : BRL_CENTS).format(value);

const SHORT_DATE = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
});

/** "10/11/26" em horário de Brasília. */
export const formatShortDate = (iso: string): string => SHORT_DATE.format(new Date(iso));

/** Diferença percentual de `value` para `reference` (negativo = abaixo), 1 casa. */
export const deltaPct = (value: number, reference: number): number =>
  reference > 0 ? Math.round(((value - reference) / reference) * 1000) / 10 : 0;

/** URL da página de histórico de um produto. */
export const productPath = (productKey: string): string =>
  `/precos/${encodeURIComponent(productKey)}`;
