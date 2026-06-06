import { describe, expect, it } from 'vitest';

import { createMessageFingerprint, getMessageText, normalizeText } from './index.js';

describe('normalizeText (bordas)', () => {
  it('trata só-espaços como vazio após trim', () => {
    expect(normalizeText('   ')).toBe('');
  });

  it('preserva números e símbolos', () => {
    expect(normalizeText('100% OFF')).toBe('100% off');
  });
});

describe('getMessageText', () => {
  it('retorna null para conteúdo nulo', () => {
    expect(getMessageText(null)).toBeNull();
  });

  it('lê conversation', () => {
    expect(getMessageText({ conversation: 'oi' })).toBe('oi');
  });

  it('lê legenda de imagem', () => {
    expect(getMessageText({ imageMessage: { caption: 'oferta' } })).toBe('oferta');
  });

  it('lê extendedTextMessage', () => {
    expect(getMessageText({ extendedTextMessage: { text: 'promo' } })).toBe('promo');
  });

  it('recursa em mensagem citada (paridade com legado)', () => {
    expect(getMessageText({ quotedMessage: { conversation: 'citada' } })).toBe('citada');
  });
});

describe('createMessageFingerprint', () => {
  it('é estável dentro do mesmo minuto', () => {
    // 1000s e 1010s caem no mesmo bucket (floor(/60) = 16)
    const a = createMessageFingerprint('joao', 'oferta', 1000);
    const b = createMessageFingerprint('joao', 'oferta', 1010);
    expect(a).toBe(b);
  });

  it('muda quando passa de minuto', () => {
    // 1000s (bucket 16) vs 1100s (bucket 18)
    const a = createMessageFingerprint('joao', 'oferta', 1000);
    const b = createMessageFingerprint('joao', 'oferta', 1100);
    expect(a).not.toBe(b);
  });

  it('retorna null sem texto', () => {
    expect(createMessageFingerprint('joao', '', 1000)).toBeNull();
  });
});
