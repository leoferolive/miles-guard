import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatAlertTime,
  formatDetectionAlert,
  markdownToPlainText,
  TelegramNotifier,
} from './telegram.js';

describe('formatDetectionAlert', () => {
  it('monta o alerta com grupo, keywords e corpo', () => {
    const out = formatDetectionAlert({
      groupName: 'IURI',
      sender: 'Fulano',
      text: 'Monitor Gamer 27',
      matchedKeywords: ['Monitor'],
      time: '10:00',
    });
    expect(out).toContain('IURI');
    expect(out).toContain('#Monitor');
    expect(out).toContain('Monitor Gamer 27');
  });
});

/** Fora do bloco ``` todo `_`/`*` de dado dinâmico precisa estar escapado com `\`. */
function unescapedOutsideCode(markdown: string, char: '_' | '[' | '`'): number {
  const outside = markdown.replace(/```[\s\S]*?```/g, '');
  return [...outside.matchAll(new RegExp(`(?<!\\\\)\\${char}`, 'g'))].length;
}

describe('formatDetectionAlert — Markdown seguro (alertas com "Odyssey OLED" nunca chegavam)', () => {
  it('palavra-chave com espaço vira tag com _ escapado', () => {
    const out = formatDetectionAlert({
      groupName: 'IURI',
      sender: 'Iuri',
      text: 'Monitor',
      matchedKeywords: ['Odyssey OLED', 'Ssd externo'],
      time: '10/11 16:11:50',
    });
    expect(out).toContain('#Odyssey\\_OLED #Ssd\\_externo');
    expect(unescapedOutsideCode(out, '_')).toBe(0);
  });

  it('nome do grupo e remetente com _ * [ ` são escapados', () => {
    const out = formatDetectionAlert({
      groupName: 'promo_tech [BR]',
      sender: 'bot_*ofertas*`',
      text: 'x',
      matchedKeywords: ['x'],
      time: '10/11 16:11:50',
    });
    expect(out).toContain('promo\\_tech \\[BR]');
    expect(out).toContain('bot\\_\\*ofertas\\*\\`');
    expect(unescapedOutsideCode(out, '_')).toBe(0);
    expect(unescapedOutsideCode(out, '[')).toBe(0);
  });

  it('corte em 1000 caracteres não parte emoji ao meio (texto inválido → 400)', () => {
    const out = formatDetectionAlert({
      groupName: 'G',
      sender: null,
      text: `${'a'.repeat(999)}🔥🔥`,
      matchedKeywords: ['x'],
      time: '10/11 16:11:50',
    });
    expect(out).toContain(`${'a'.repeat(999)}🔥\n...`);
    // Sem surrogate UTF-16 solto (emoji partido ao meio).
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });

  it('fallback em texto puro remove os escapes de um alerta real', () => {
    const out = formatDetectionAlert({
      groupName: 'promo_tech',
      sender: null,
      text: 'x',
      matchedKeywords: ['Odyssey OLED'],
      time: '10/11 16:11:50',
    });
    const plain = markdownToPlainText(out);
    expect(plain).toContain('Grupo: promo_tech');
    expect(plain).toContain('#Odyssey_OLED');
    expect(plain).not.toContain('\\');
  });

  it('``` no corpo da mensagem não fecha o bloco de código antes da hora', () => {
    const out = formatDetectionAlert({
      groupName: 'G',
      sender: null,
      text: 'antes ``` depois',
      matchedKeywords: ['x'],
      time: '10/11 16:11:50',
    });
    expect(out.match(/```/g)).toHaveLength(2);
  });
});

describe('formatDetectionAlert — histórico de preço', () => {
  const base = {
    groupName: 'IURI',
    sender: 'Iuri',
    text: 'Ryzen 7 5800X3D',
    matchedKeywords: ['x3d'],
    time: '10/11 16:11:50',
  };

  it('mostra a mediana, quantas ofertas e quanto está abaixo', () => {
    const out = formatDetectionAlert({
      ...base,
      price: { current: 1701, insight: { median: 1750, sampleSize: 12, deltaPct: -2.8, badge: null } },
    });
    expect(out).toContain('📊 *Mediana:* R$\u00a01.750 (12 ofertas) · 2,8% abaixo');
    expect(out).not.toContain('🏆');
  });

  it('mediana com centavos sai com 2 casas (R$ 1.709,50)', () => {
    const out = formatDetectionAlert({
      ...base,
      price: { current: 1701, insight: { median: 1709.5, sampleSize: 4, deltaPct: -0.5, badge: null } },
    });
    expect(out).toContain('R$\u00a01.709,50');
  });

  it('acima da mediana', () => {
    const out = formatDetectionAlert({
      ...base,
      price: { current: 1969, insight: { median: 1750, sampleSize: 12, deltaPct: 12.5, badge: null } },
    });
    expect(out).toContain('12,5% acima');
  });

  it('marca o menor preço já visto', () => {
    const out = formatDetectionAlert({
      ...base,
      price: { current: 1600, insight: { median: 1750, sampleSize: 12, deltaPct: -8.6, badge: 'lowest' } },
    });
    expect(out).toContain('🏆 *Menor preço já visto!*');
  });

  it('marca "entre os menores"', () => {
    const out = formatDetectionAlert({
      ...base,
      price: { current: 1680, insight: { median: 1750, sampleSize: 12, deltaPct: -4, badge: 'among_lowest' } },
    });
    expect(out).toContain('📉 *Entre os menores preços*');
  });

  it('mostra a categoria do produto', () => {
    const out = formatDetectionAlert({ ...base, category: 'Processador' });
    expect(out).toContain('🏷 *Categoria:* Processador');
  });

  it('categoria "Outros" não aparece (não ajuda a separar nada)', () => {
    const out = formatDetectionAlert({ ...base, category: 'Outros' });
    expect(out).not.toContain('Categoria');
  });

  it('inclui o link do histórico no Painel quando informado', () => {
    const out = formatDetectionAlert({
      ...base,
      price: { current: 1701, insight: null },
      historyUrl: 'https://nossoradar.example/precos/c%3A5800x3d',
    });
    expect(out).toContain('📈 Histórico: https://nossoradar.example/precos/c%3A5800x3d');
  });

  it('sem histórico suficiente: não mostra nada de preço', () => {
    const out = formatDetectionAlert({ ...base, price: { current: 1701, insight: null } });
    expect(out).not.toContain('Mediana');
  });
});

describe('formatAlertTime', () => {
  it('formata em horário de Brasília com data, independente do fuso do processo', () => {
    // 19:11:50 UTC = 16:11:50 em America/Sao_Paulo (UTC-3, sem horário de verão).
    expect(formatAlertTime(new Date('2026-11-10T19:11:50Z'))).toBe('10/11 16:11:50');
  });

  it('mostra o dia de Brasília quando a virada de dia em UTC ainda não ocorreu lá', () => {
    // 02:30 UTC do dia 11 ainda é 23:30 do dia 10 em Brasília.
    expect(formatAlertTime(new Date('2026-11-11T02:30:00Z'))).toBe('10/11 23:30:00');
  });
});

describe('TelegramNotifier — resiliência de entrega', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function silenceLogs(): void {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  }

  it('reentrega em falha transitória e confirma (onSent) no sucesso', async () => {
    silenceLogs();
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls < 3) return { ok: false, status: 503, text: async () => 'busy' } as unknown as Response;
      return { ok: true } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const onSent = vi.fn();
    // ratePerMinute alto => intervalMs ~1ms (loop rápido no teste).
    const notifier = new TelegramNotifier('tok', 'chat', 60_000);
    notifier.enqueue('alerta', onSent);

    await vi.waitFor(() => expect(onSent).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 falhas + 1 sucesso
    notifier.stop();
  });

  it('Telegram recusa o Markdown (400 parse) → reenvia na hora em texto puro e confirma', async () => {
    silenceLogs();
    const bodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      if (bodies.length === 1) {
        return {
          ok: false,
          status: 400,
          text: async () =>
            '{"ok":false,"error_code":400,"description":"Bad Request: can\'t parse entities: Can\'t find end of the entity starting at byte offset 120"}',
        } as unknown as Response;
      }
      return { ok: true } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const onSent = vi.fn();
    const notifier = new TelegramNotifier('tok', 'chat', 60_000);
    notifier.enqueue('🔍 *Palavras-chave:* #Odyssey_OLED', onSent);

    await vi.waitFor(() => expect(onSent).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodies[0]?.parse_mode).toBe('Markdown');
    expect(bodies[1]?.parse_mode).toBeUndefined();
    // Texto puro: sem os marcadores de Markdown (e sem os escapes).
    expect(bodies[1]?.text).toBe('🔍 Palavras-chave: #Odyssey_OLED');
    notifier.stop();
  });

  it('desiste após maxAttempts (5) e NÃO confirma a detecção', async () => {
    silenceLogs();
    const fetchMock = vi.fn(
      async () => ({ ok: false, status: 500, text: async () => 'err' }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const onSent = vi.fn();
    const notifier = new TelegramNotifier('tok', 'chat', 60_000);
    notifier.enqueue('alerta', onSent);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5), { timeout: 2000 });
    expect(onSent).not.toHaveBeenCalled();
    notifier.stop();
  });

  it('desabilitado (sem token) não enfileira nem chama fetch', async () => {
    silenceLogs();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const onSent = vi.fn();
    const notifier = new TelegramNotifier('', '', 60_000);
    notifier.enqueue('alerta', onSent);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    notifier.stop();
  });
});
