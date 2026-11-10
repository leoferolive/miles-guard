import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatAlertTime, formatDetectionAlert, TelegramNotifier } from './telegram.js';

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
