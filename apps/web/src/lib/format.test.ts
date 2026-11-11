import { describe, expect, it } from 'vitest';

import { deltaPct, formatBRL, productPath } from './format';

describe('format', () => {
  it('formatBRL: inteiro sem centavos, fracionado sempre com 2 casas', () => {
    expect(formatBRL(1701)).toBe('R$ 1.701');
    expect(formatBRL(3578.5)).toBe('R$ 3.578,50');
    expect(formatBRL(124.89)).toBe('R$ 124,89');
  });

  it('deltaPct com 1 casa e negativo quando abaixo', () => {
    expect(deltaPct(1671, 1718)).toBe(-2.7);
    expect(deltaPct(10, 0)).toBe(0);
  });

  it('productPath codifica a chave', () => {
    expect(productPath('w:2+laminas')).toBe('/precos/w%3A2%2Blaminas');
  });
});
