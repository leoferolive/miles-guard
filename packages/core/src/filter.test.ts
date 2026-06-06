import { describe, expect, it } from 'vitest';

import { matchKeywords, normalizeText } from './index.js';

describe('normalizeText', () => {
  it('baixa caixa e remove acentos', () => {
    expect(normalizeText('Bônus LATAM')).toBe('bonus latam');
  });

  it('retorna string vazia para entrada vazia', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('matchKeywords', () => {
  it('casa ignorando acento e caixa por padrão', () => {
    expect(matchKeywords('Promoção 100% de bônus', ['bonus', '100%'])).toEqual(['bonus', '100%']);
  });

  it('NÃO casa keyword de outro tema (isolamento por grupo)', () => {
    expect(matchKeywords('passagem para Curitiba', ['rtx', 'ps5'])).toEqual([]);
  });

  it('respeita caseSensitive quando pedido', () => {
    expect(matchKeywords('latam', ['LATAM'], { caseSensitive: true })).toEqual([]);
  });

  it('sem keywords retorna vazio', () => {
    expect(matchKeywords('qualquer coisa', [])).toEqual([]);
  });
});
