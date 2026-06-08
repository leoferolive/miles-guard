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

describe('getMessageText — folhas básicas', () => {
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

  it('lê legenda de vídeo e ptv', () => {
    expect(getMessageText({ videoMessage: { caption: 'video promo' } })).toBe('video promo');
    expect(getMessageText({ ptvMessage: { caption: 'ptv promo' } })).toBe('ptv promo');
  });

  it('lê legenda/título de documento', () => {
    expect(getMessageText({ documentMessage: { caption: 'catálogo' } })).toBe('catálogo');
    expect(getMessageText({ documentMessage: { title: 'tabela.pdf' } })).toBe('tabela.pdf');
  });

  it('ignora só-espaços e cai para o próximo campo', () => {
    expect(getMessageText({ conversation: '   ', extendedTextMessage: { text: 'real' } })).toBe('real');
  });

  it('retorna null para mensagem só de mídia (sem texto)', () => {
    expect(getMessageText({ imageMessage: {} })).toBeNull();
    expect(getMessageText({ audioMessage: { seconds: 5 } } as never)).toBeNull();
  });
});

describe('getMessageText — envelopes (desembrulho recursivo)', () => {
  it('desembrulha ephemeralMessage (modo temporário — bug central do IURI)', () => {
    expect(
      getMessageText({ ephemeralMessage: { message: { conversation: 'oferta efêmera' } } }),
    ).toBe('oferta efêmera');
  });

  it('desembrulha viewOnceMessageV2 com legenda', () => {
    expect(
      getMessageText({ viewOnceMessageV2: { message: { imageMessage: { caption: 'view once' } } } }),
    ).toBe('view once');
  });

  it('desembrulha editedMessage no topo', () => {
    expect(getMessageText({ editedMessage: { message: { conversation: 'editada' } } })).toBe('editada');
  });

  it('desembrulha protocolMessage.editedMessage (caminho real de edição)', () => {
    expect(
      getMessageText({ protocolMessage: { editedMessage: { conversation: 'edição via protocolo' } } }),
    ).toBe('edição via protocolo');
  });

  it('desembrulha deviceSentMessage', () => {
    expect(
      getMessageText({ deviceSentMessage: { message: { conversation: 'espelhada' } } }),
    ).toBe('espelhada');
  });

  it('desembrulha envelopes aninhados (ephemeral dentro de deviceSent)', () => {
    expect(
      getMessageText({
        deviceSentMessage: { message: { ephemeralMessage: { message: { conversation: 'fundo' } } } },
      }),
    ).toBe('fundo');
  });

  it('não entra em loop infinito com envelope cíclico (depth guard)', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.ephemeralMessage = { message: cyclic };
    expect(getMessageText(cyclic as never)).toBeNull();
  });
});

describe('getMessageText — formatos de bot / promo', () => {
  it('lê templateMessage hydratedTemplate', () => {
    expect(
      getMessageText({ templateMessage: { hydratedTemplate: { hydratedContentText: 'promo template' } } }),
    ).toBe('promo template');
  });

  it('lê templateMessage hydratedFourRowTemplate', () => {
    expect(
      getMessageText({
        templateMessage: { hydratedFourRowTemplate: { hydratedContentText: 'four row' } },
      }),
    ).toBe('four row');
  });

  it('lê interactiveMessage body.text', () => {
    expect(getMessageText({ interactiveMessage: { body: { text: 'interativa' } } })).toBe('interativa');
  });

  it('lê buttonsMessage contentText', () => {
    expect(getMessageText({ buttonsMessage: { contentText: 'com botões' } })).toBe('com botões');
  });

  it('lê listMessage description', () => {
    expect(getMessageText({ listMessage: { description: 'lista de ofertas' } })).toBe('lista de ofertas');
  });

  it('lê productMessage (título do produto)', () => {
    expect(
      getMessageText({ productMessage: { product: { title: 'Monitor Gamer 27' } } }),
    ).toBe('Monitor Gamer 27');
  });

  it('lê pollCreationMessage (nome + opções)', () => {
    expect(
      getMessageText({
        pollCreationMessage: { name: 'Qual oferta?', options: [{ optionName: 'A' }, { optionName: 'B' }] },
      }),
    ).toBe('Qual oferta? A B');
  });

  it('lê groupInviteMessage caption', () => {
    expect(getMessageText({ groupInviteMessage: { caption: 'entre no grupo' } })).toBe('entre no grupo');
  });

  it('combina envelope + formato de bot (template dentro de ephemeral)', () => {
    expect(
      getMessageText({
        ephemeralMessage: { message: { templateMessage: { hydratedTemplate: { hydratedContentText: 'oferta bot efêmera' } } } },
      }),
    ).toBe('oferta bot efêmera');
  });
});

describe('getMessageText — mensagem citada (quoted)', () => {
  it('recursa em quotedMessage no topo (paridade com legado)', () => {
    expect(getMessageText({ quotedMessage: { conversation: 'citada' } })).toBe('citada');
  });

  it('recursa no quoted real (extendedTextMessage.contextInfo.quotedMessage)', () => {
    expect(
      getMessageText({
        extendedTextMessage: { contextInfo: { quotedMessage: { conversation: 'original citada' } } },
      }),
    ).toBe('original citada');
  });

  it('prefere o texto direto ao quoted', () => {
    expect(
      getMessageText({
        extendedTextMessage: { text: 'resposta', contextInfo: { quotedMessage: { conversation: 'antiga' } } },
      }),
    ).toBe('resposta');
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
