import { normalizeText } from './text.js';

/**
 * Retorna as palavras-chave que casam com o texto da mensagem.
 *
 * Modelo por-grupo (CONTEXT.md / ADR): as `keywords` pertencem a UM Grupo
 * Monitorado. O casamento é por substring; por padrão ignora acento e caixa
 * (via normalizeText), exatamente como o MilesGuard original.
 */
export function matchKeywords(
  text: string,
  keywords: string[],
  options: { caseSensitive?: boolean } = {},
): string[] {
  if (!text || keywords.length === 0) return [];
  const caseSensitive = options.caseSensitive ?? false;
  const haystack = caseSensitive ? text : normalizeText(text);

  return keywords.filter((keyword) => {
    const needle = caseSensitive ? keyword : normalizeText(keyword);
    return needle.length > 0 && haystack.includes(needle);
  });
}
