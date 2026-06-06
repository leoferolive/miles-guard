# CLAUDE.md

Guia para o Claude Code neste repositório.

## Visão geral

**nossoRadar** (nome de trabalho; evolução do MilesGuard) é um **monitor web single-user de ofertas/alertas em
grupos do WhatsApp**: observa grupos por palavras-chave próprias de cada grupo e notifica no Telegram, com um painel
web para gestão e visualização. Roda no homeserver **k3s (arm64)**, alinhado a `nossalista`/`nossagrana`/`chat-api`.

Glossário do domínio: ver [`CONTEXT.md`](./CONTEXT.md). Decisões de arquitetura: ver [`docs/adr/`](./docs/adr/).

## Arquitetura (ADR-0002/0003/0004)

Dois processos que **não se falam diretamente** — conversam via **Postgres** (durável) + **`LISTEN/NOTIFY`** (efêmero):

- **`apps/worker`** — singleton (`replicas:1`, `Recreate`, PVC de sessão). Mantém a conexão Baileys, aplica o filtro
  por JID, grava `detections` e dispara o Alerta de Detecção no Telegram.
- **`apps/api`** — Fastify: API + WebSocket + Google OAuth (allowlist) e serve o SPA buildado.
- **`apps/web`** — React + Vite (painel).
- **`packages/core`** — lógica de domínio portada (filtro/normalização).
- **`packages/db`** — schema Drizzle + client postgres-js (+ barramento LISTEN/NOTIFY).
- **`packages/shared`** — contratos zod + nomes dos canais NOTIFY.
- **`legacy/`** — MilesGuard original (CommonJS), só referência do porte. Não evoluir.

## Comandos

```bash
pnpm install              # instala o workspace
pnpm dev                  # turbo: dev de todos os apps
pnpm build                # turbo: build (libs → dist; web → vite)
pnpm type-check           # turbo: tsc --noEmit
pnpm test                 # turbo: vitest

docker compose up -d postgres                 # Postgres 17 local
pnpm -C packages/db db:generate               # gera migration a partir do schema
pnpm -C packages/db db:migrate                # aplica migrations
```

## Convenções

- **ESM** (`type: module`) em tudo; imports relativos com extensão `.js`.
- TypeScript estrito; libs (`packages/*`) buildam para `dist` e são consumidas via `@nossoradar/*` (`workspace:*`).
- Stack alinhada ao `nossagrana`: pnpm + turbo, Fastify, Drizzle + postgres-js, React/Vite, Vitest, zod 3.
- Segredos: k8s Secrets planos (fora do git); `.env.example` lista as variáveis (inclui `ALLOWED_EMAILS`).
- Deploy: imagens `ghcr.io/leoferolive/nossoradar-{worker,web}`, manifests crus `k8s/{dev,prod}`, Traefik + Cloudflare Tunnel.

> Lint (eslint/oxlint) ainda não está configurado — fica para um PR dedicado.
