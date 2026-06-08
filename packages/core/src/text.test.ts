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

  it('lê legenda/título de documento (mas NÃO fileName — evita falso positivo)', () => {
    expect(getMessageText({ documentMessage: { caption: 'catálogo' } })).toBe('catálogo');
    expect(getMessageText({ documentMessage: { title: 'tabela' } })).toBe('tabela');
    // fileName tipo 'oferta_latam.pdf' não é texto humano e não deve casar keyword.
    expect(getMessageText({ documentMessage: { fileName: 'oferta_latam.pdf' } } as never)).toBeNull();
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

  it('lê listMessage sections[].rows[] (itens reais da lista)', () => {
    expect(
      getMessageText({
        listMessage: {
          title: 'Ofertas',
          sections: [
            { title: 'Voos', rows: [{ title: 'LATAM 100%', description: 'bônus' }] },
          ],
        },
      }),
    ).toBe('Ofertas Voos LATAM 100% bônus');
  });

  it('lê interactiveMessage nativeFlow (display_text no buttonParamsJson)', () => {
    expect(
      getMessageText({
        interactiveMessage: {
          nativeFlowMessage: {
            buttons: [{ buttonParamsJson: '{"display_text":"Ver oferta LATAM"}' }],
          },
        },
      }),
    ).toBe('Ver oferta LATAM');
  });

  it('nativeFlow com JSON inválido não quebra (retorna null)', () => {
    expect(
      getMessageText({
        interactiveMessage: { nativeFlowMessage: { buttons: [{ buttonParamsJson: '{nao-e-json' }] } },
      }),
    ).toBeNull();
  });

  it('nativeFlow com display_text vazio cai para title (não mascara)', () => {
    expect(
      getMessageText({
        interactiveMessage: {
          nativeFlowMessage: {
            buttons: [{ buttonParamsJson: '{"display_text":"","title":"PROMO LATAM 100%"}' }],
          },
        },
      }),
    ).toBe('PROMO LATAM 100%');
  });

  it('lê buttonsMessage com header de mídia (caption da imagem)', () => {
    expect(
      getMessageText({ buttonsMessage: { imageMessage: { caption: 'promo na imagem' } } }),
    ).toBe('promo na imagem');
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

describe('getMessageText — mensagem citada (quoted): NÃO é fonte de texto', () => {
  // Decisão (revisão PR #13): citar uma oferta não é repostá-la. Usar o quoted como
  // única fonte gerava detecção duplicada com sender/timestamp errados (B2).

  it('resposta SEM texto próprio citando oferta antiga retorna null (não duplica detecção)', () => {
    expect(
      getMessageText({
        imageMessage: { contextInfo: { quotedMessage: { conversation: 'LATAM 100% bônus' } } },
      } as never),
    ).toBeNull();
  });

  it('considera só o texto PRÓPRIO da resposta, ignorando o quoted', () => {
    expect(
      getMessageText({
        extendedTextMessage: {
          text: 'ainda vale?',
          contextInfo: { quotedMessage: { conversation: 'LATAM 100% bônus' } },
        },
      } as never),
    ).toBe('ainda vale?');
  });

  it('quoted auto-referente (cíclico) não estoura a pilha — retorna null', () => {
    const c: Record<string, unknown> = {};
    c.extendedTextMessage = { contextInfo: { quotedMessage: c } };
    expect(getMessageText(c as never)).toBeNull();
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
