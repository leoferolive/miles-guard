import { getUserById, upsertUser } from '@nossoradar/db';
import { authUserSchema } from '@nossoradar/shared';
import bcrypt from 'bcryptjs';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { env } from '../env.js';
import { clientIp } from '../security/client-ip.js';
import { LoginFailureGuard, type LoginFailureGuardOptions } from '../security/login-failure-guard.js';

/** Body do login: e-mail + senha (ADR-0007). Trim do e-mail antes de validar. */
const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/** Mensagem genérica de 401 — NÃO revela qual campo falhou (anti-enumeração). */
const INVALID_CREDENTIALS = 'Credenciais inválidas.';

/** Default da trava global: 20 falhas em 15 min (de qualquer IP) travam o login. */
const DEFAULT_LOGIN_FAILURE_LIMIT: LoginFailureGuardOptions = {
  maxFailures: 20,
  windowMs: 15 * 60 * 1000,
};

export interface AuthRoutesOptions {
  loginFailureLimit?: LoginFailureGuardOptions;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, opts) => {
  const loginGuard = new LoginFailureGuard(opts.loginFailureLimit ?? DEFAULT_LOGIN_FAILURE_LIMIT);

  /**
   * POST /api/auth/login (ADR-0007): valida e-mail (== AUTH_EMAIL) + senha
   * (bcrypt.compare contra AUTH_PASSWORD_HASH). Em sucesso: upsert do Usuário,
   * emite o MESMO JWT de sessão (7d, payload { sub, email }) e devolve { token, user }.
   * Em qualquer falha: 401 genérico (não revela se foi e-mail ou senha).
   *
   * Rate-limit estrito por-rota contra brute force (além do limite global):
   * 5 tentativas / minuto por IP real do cliente (clientIp: CF-Connecting-IP, nunca
   * X-Forwarded-For). Sem efeito em testes (plugin global desabilitado). Além disso,
   * uma trava GLOBAL (LoginFailureGuard) barra brute force distribuído entre IPs.
   */
  fastify.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: clientIp,
        },
      },
    },
    async (request, reply) => {
      if (loginGuard.isLocked()) {
        request.log.warn({ ip: clientIp(request) }, 'login bloqueado: trava global de falhas');
        return reply
          .code(429)
          .send({ message: 'Muitas tentativas de login. Tente novamente mais tarde.' });
      }

      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        // Body malformado também vira 401 genérico (sem vazar a forma esperada).
        loginGuard.recordFailure();
        return reply.code(401).send({ message: INVALID_CREDENTIALS });
      }

      const email = parsed.data.email.trim().toLowerCase();

      // Comparamos a senha SEMPRE (mesmo com e-mail errado) para não dar pista de
      // timing sobre qual e-mail existe. O resultado só importa se o e-mail casa.
      const passwordOk = await bcrypt.compare(parsed.data.password, env.AUTH_PASSWORD_HASH);
      const emailOk = email === env.AUTH_EMAIL;

      if (!emailOk || !passwordOk) {
        loginGuard.recordFailure();
        request.log.warn({ email, ip: clientIp(request) }, 'login negado: credenciais inválidas');
        return reply.code(401).send({ message: INVALID_CREDENTIALS });
      }

      const user = await upsertUser({
        email,
        // Nome derivado do e-mail (parte local) — sem dado de perfil externo.
        name: email.split('@')[0] ?? null,
        avatarUrl: null,
      });

      const token = fastify.jwt.sign({ sub: user.id, email: user.email });

      return reply.send({ token, user: authUserSchema.parse(user) });
    },
  );

  /** GET /api/me (protegido) → usuário atual. */
  fastify.get('/me', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const user = await getUserById(request.user.sub);
    if (!user) {
      return reply.code(404).send({ message: 'Usuário não encontrado.' });
    }
    return authUserSchema.parse(user);
  });
};
