import fastifyOauth2 from '@fastify/oauth2';
import fp from 'fastify-plugin';

import { env } from '../env.js';

/**
 * Registra o fluxo Google OAuth2 (ADR-0005), reaproveitando a credencial do nossalista.
 *
 * - `GET /api/auth/google` (startRedirectPath) → redireciona ao Google (escopos openid email profile).
 * - O callback `GET /api/auth/google/callback` é tratado em `auth.routes.ts` (troca code → userinfo →
 *   allowlist → upsert → JWT → redirect ao SPA).
 *
 * Só é registrado quando `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` existem; sem credencial
 * (testes/dev), o início do fluxo responde 503 (ver auth.routes.ts).
 *
 * IMPORTANTE: o redirect URI `${PUBLIC_URL}/api/auth/google/callback` precisa estar cadastrado
 * nos "Authorized redirect URIs" do OAuth Client no Google Cloud.
 */
export const oauthPlugin = fp(async (fastify) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    fastify.log.warn('Google OAuth desabilitado: GOOGLE_CLIENT_ID/SECRET ausentes.');
    return;
  }

  await fastify.register(fastifyOauth2, {
    name: 'googleOAuth2',
    scope: ['openid', 'email', 'profile'],
    credentials: {
      client: {
        id: env.GOOGLE_CLIENT_ID,
        secret: env.GOOGLE_CLIENT_SECRET,
      },
      auth: fastifyOauth2.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: '/api/auth/google',
    callbackUri: `${env.PUBLIC_URL}/api/auth/google/callback`,
  });
});
