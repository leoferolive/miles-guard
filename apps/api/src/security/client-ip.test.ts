import { describe, expect, it } from 'vitest';

import { clientIp } from './client-ip.js';

function req(headers: Record<string, string | string[] | undefined>, remoteAddress?: string) {
  return { headers, socket: { remoteAddress } } as unknown as Parameters<typeof clientIp>[0];
}

describe('clientIp', () => {
  it('prefere o CF-Connecting-IP', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '198.51.100.7' }, '10.42.0.1'))).toBe('198.51.100.7');
  });

  it('ignora X-Forwarded-For e cai no IP do socket sem CF-Connecting-IP', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }, '10.42.0.1'))).toBe('10.42.0.1');
  });

  it('descarta CF-Connecting-IP vazio ou repetido (array)', () => {
    expect(clientIp(req({ 'cf-connecting-ip': '  ' }, '10.42.0.1'))).toBe('10.42.0.1');
    expect(clientIp(req({ 'cf-connecting-ip': ['1.1.1.1', '2.2.2.2'] }, '10.42.0.1'))).toBe(
      '10.42.0.1',
    );
  });

  it('sem nada disponível, devolve "unknown"', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});
