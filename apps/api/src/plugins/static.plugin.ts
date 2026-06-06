import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import fp from 'fastify-plugin';

import { env } from '../env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Serve a SPA React (build do Vite) a partir do próprio Painel — o deployment
 * combinado `web` (ADR/Fase 4). Rotas não-/api caem no index.html (history fallback),
 * para o roteamento client-side do react-router funcionar em refresh/deep-link.
 *
 * Resolve `apps/web/dist` relativo a este arquivo compilado (apps/api/dist/plugins).
 * Guardado: se o dist não existir (dev sem build do front), o plugin é no-op
 * para não quebrar a API.
 */
function resolveSpaDir(): string | null {
  // Permite override explícito (ex.: container com layout diferente) — validado no env zod.
  const fromEnv = env.WEB_DIST_PATH;
  const candidates = [
    fromEnv,
    // apps/api/dist/plugins -> ../../../web/dist (monorepo)
    resolve(__dirname, '../../../web/dist'),
    // apps/api/dist/plugins -> ../../../../apps/web/dist (layout achatado)
    resolve(__dirname, '../../../../apps/web/dist'),
  ].filter((p): p is string => Boolean(p));

  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  return null;
}

export const staticPlugin = fp(async (fastify) => {
  const spaDir = resolveSpaDir();

  if (!spaDir) {
    fastify.log.warn(
      'SPA dist não encontrado — Painel servirá apenas a API (rode `pnpm -C apps/web build`).',
    );
    return;
  }

  await fastify.register(import('@fastify/static'), {
    root: spaDir,
    // Hardening (revisão Dev Sr):
    // - dotfiles 'deny': nunca servir arquivos ocultos (.env, .git, etc.).
    // - index false: nada de directory-index implícito; o index.html só vai pelo fallback.
    // - serveDotFiles default false reforça o confinamento ao root.
    // O @fastify/static já confina ao `root` e bloqueia path traversal (../).
    dotfiles: 'deny',
    index: false,
    wildcard: false,
  });

  // History fallback: qualquer GET que NÃO seja /api, /ws, /healthz, /metrics
  // e que não tenha casado um arquivo estático → devolve o index.html da SPA.
  fastify.setNotFoundHandler((request, reply) => {
    const isApiLike =
      request.url.startsWith('/api') ||
      request.url.startsWith('/ws') ||
      request.url.startsWith('/healthz') ||
      request.url.startsWith('/metrics');

    if (request.method === 'GET' && !isApiLike) {
      return reply.type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ message: 'Não encontrado.' });
  });

  fastify.log.info({ spaDir }, 'SPA estática registrada no Painel');
});
