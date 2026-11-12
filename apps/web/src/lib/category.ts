/**
 * Categoria "desconhecida" (ADR-0008): o classificador não reconheceu o produto. Passa por
 * qualquer restrição de Palavra-chave, então não faz sentido escolhê-la nem exibi-la como rótulo.
 * Espelha `OTHER_CATEGORY` de `@nossoradar/core` (o web não depende do core).
 */
export const OTHER_CATEGORY = 'Outros';

/** Rótulo de categoria a exibir num card/linha (null/"Outros" = nada a mostrar). */
export function visibleCategory(category: string | null | undefined): string | null {
  return category && category !== OTHER_CATEGORY ? category : null;
}

/** Descreve onde a Palavra-chave vale: "só em: Processador, Kit" ou "qualquer categoria". */
export function describeKeywordScope(categories: string[]): string {
  return categories.length === 0 ? 'qualquer categoria' : `só em: ${categories.join(', ')}`;
}
