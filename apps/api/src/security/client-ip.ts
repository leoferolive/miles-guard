import { isIPv4, isIPv6 } from 'node:net';

import type { FastifyRequest } from 'fastify';

/**
 * Identidade do cliente para rate-limit e logs. NÃO usa `request.ip`: com
 * `trustProxy: true` ele vem do 1º valor do X-Forwarded-For, que o cliente controla
 * (o Cloudflare só acrescenta ao header recebido). O `CF-Connecting-IP` é sempre
 * sobrescrito pelo Cloudflare com o IP real; sem ele, usa o IP do socket.
 *
 * IPv6 é agrupado pelo /64: qualquer VPS recebe um /64 inteiro, e contar por /128
 * deixaria o atacante trocar de endereço a cada tentativa.
 */
export function clientIp(request: Pick<FastifyRequest, 'headers' | 'socket'>): string {
  const cf = request.headers['cf-connecting-ip'];
  const raw =
    typeof cf === 'string' && cf.trim() !== '' ? cf.trim() : request.socket?.remoteAddress;
  return raw ? normalizeIp(raw) : 'unknown';
}

function normalizeIp(ip: string): string {
  if (!isIPv6(ip)) return ip;

  // IPv4 mapeado em IPv6 (::ffff:a.b.c.d) é um IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1] && isIPv4(mapped[1])) return mapped[1];

  return `${expandIPv6(ip).slice(0, 4).join(':')}::/64`;
}

/** Expande um IPv6 (com `::`) para 8 hextets normalizados (minúsculos, sem zeros à esquerda). */
function expandIPv6(ip: string): string[] {
  const [head = '', tail] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...Array<string>(missing).fill('0'), ...right].map((h) =>
    h.includes('.') ? h : (parseInt(h, 16) || 0).toString(16),
  );
}
