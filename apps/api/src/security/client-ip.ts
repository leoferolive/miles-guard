import type { FastifyRequest } from 'fastify';

/**
 * IP do cliente para rate-limit e logs. NÃO usa `request.ip`: com `trustProxy: true`
 * ele vem do 1º valor do X-Forwarded-For, que o cliente controla (o Cloudflare só
 * acrescenta ao header recebido). O `CF-Connecting-IP` é sempre sobrescrito pelo
 * Cloudflare com o IP real; sem ele (acesso direto ao cluster), usa o IP do socket.
 */
export function clientIp(request: Pick<FastifyRequest, 'headers' | 'socket'>): string {
  const cf = request.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim() !== '') return cf.trim();
  return request.socket?.remoteAddress ?? 'unknown';
}
