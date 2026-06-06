import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../env.js';

/** Payload do JWT de sessão (ADR-0005). */
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler: exige JWT válido no header Authorization: Bearer. */
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * Registra @fastify/jwt (segredo = JWT_SECRET, validade JWT_EXPIRES_IN) e decora
 * `requireAuth`, que verifica o token e popula `request.user`.
 */
export const authPlugin = fp(async (fastify) => {
  await fastify.register(import('@fastify/jwt'), {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  fastify.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ message: 'Nao autenticado' });
    }
  });
});
