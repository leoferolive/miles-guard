import type { OAuth2Namespace } from '@fastify/oauth2';
import { getUserById, upsertUser } from '@nossoradar/db';
import { authUserSchema } from '@nossoradar/shared';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { env, isEmailAllowed } from '../env.js';

const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

/** O decorator do @fastify/oauth2 leva o nome do plugin (`googleOAuth2`); tipamos o acesso. */
function getGoogleOAuth(fastify: FastifyInstance): OAuth2Namespace | undefined {
  return (fastify as FastifyInstance & { googleOAuth2?: OAuth2Namespace }).googleOAuth2;
}

/** Resposta esperada do endpoint OpenID Connect userinfo do Google. */
const googleUserinfoSchema = z.object({
  email: z.string().email(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/auth/google → quando o OAuth está habilitado, o @fastify/oauth2 já registra
   * o redirect nesse path (startRedirectPath). Esta rota só existe como fallback claro
   * quando o OAuth está DESABILITADO (sem credencial).
   */
  if (!getGoogleOAuth(fastify)) {
    fastify.get('/auth/google', async (_request, reply) => {
      return reply.code(503).send({ message: 'Google OAuth não configurado.' });
    });
  }

  /**
   * Callback do Google (ADR-0005): troca code → userinfo → CHECK allowlist → upsert → JWT → SPA.
   * Redirect URI a cadastrar no Google: `${PUBLIC_URL}/api/auth/google/callback`.
   */
  fastify.get('/auth/google/callback', async (request, reply) => {
    const oauth = getGoogleOAuth(fastify);
    if (!oauth) {
      return reply.code(503).send({ message: 'Google OAuth não configurado.' });
    }

    let accessToken: string;
    try {
      const result = await oauth.getAccessTokenFromAuthorizationCodeFlow(request);
      accessToken = result.token.access_token;
    } catch (err) {
      request.log.error({ err }, 'falha ao trocar o código OAuth');
      return reply.code(401).send({ message: 'Falha na autenticação com o Google.' });
    }

    let userinfo: z.infer<typeof googleUserinfoSchema>;
    try {
      const res = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`userinfo HTTP ${res.status}`);
      userinfo = googleUserinfoSchema.parse(await res.json());
    } catch (err) {
      request.log.error({ err }, 'falha ao obter userinfo do Google');
      return reply.code(401).send({ message: 'Não foi possível obter o perfil do Google.' });
    }

    // CRÍTICO (ADR-0005): allowlist. E-mail fora da lista NÃO cria usuário e recebe 403.
    if (!isEmailAllowed(userinfo.email, env.ALLOWED_EMAILS)) {
      request.log.warn({ email: userinfo.email }, 'login negado: e-mail fora da allowlist');
      return reply.code(403).send({ message: 'E-mail não autorizado.' });
    }

    const user = await upsertUser({
      email: userinfo.email,
      name: userinfo.name ?? null,
      avatarUrl: userinfo.picture ?? null,
    });

    const token = fastify.jwt.sign({ sub: user.id, email: user.email });

    return reply.redirect(`${env.PUBLIC_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  });

  /** GET /api/me (protegido) → usuário atual. */
  fastify.get('/me', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const user = await getUserById(request.user.sub);
    if (!user) {
      return reply.code(404).send({ message: 'Usuário não encontrado.' });
    }
    return authUserSchema.parse(user);
  });
};
