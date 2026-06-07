# CLAUDE.md

Guia para o Claude Code neste repositório.

## Visão geral

**nossoRadar** (evolução do MilesGuard) é um **monitor web single-user de ofertas/alertas em grupos do
WhatsApp**: observa grupos por palavras-chave próprias de cada grupo e dispara o Alerta de Detecção no Telegram,
com um painel web para gestão e visualização. Roda no homeserver **k3s (arm64)** e está no ar em
**`nossoradar.leoferolive.com.br`**, alinhado a `nossalista`/`nossagrana`/`chat-api`.

Glossário do domínio: ver [`CONTEXT.md`](./CONTEXT.md). Decisões de arquitetura: ver [`docs/adr/`](./docs/adr/).

## Arquitetura (ADR-0002/0003/0004/0007)

Monorepo pnpm + turbo. Os processos **não se falam diretamente** — conversam via **Postgres** (durável) +
**`LISTEN/NOTIFY`** (efêmero, sem Redis). Canais NOTIFY em `packages/shared/src/channels.ts`
(`config_changed`, `refresh_groups`, `reconnect_requested`, ...).

- **`apps/worker`** — **singleton** (`replicas:1` + `strategy:Recreate` + PVC de sessão; nunca escalar/autoescalar).
  Mantém a conexão Baileys, aplica o filtro por JID, grava `detections` e dispara o Alerta de Detecção no Telegram.
  Expõe `/healthz` e `/metrics` (porta 3001).
- **`apps/api`** — **Fastify 5**: REST + WebSocket + **auth (login e-mail+senha)** + serve o SPA buildado.
  Expõe `/healthz` e `/metrics`. É a imagem deployada como `nossoradar-web` (api + `apps/web/dist`).
- **`apps/web`** — React 19 + Vite (Painel); buildado e embutido na imagem `web`.
- **`packages/core`** — lógica de domínio portada (filtro/normalização).
- **`packages/db`** — schema Drizzle + client postgres-js + repositórios (+ barramento LISTEN/NOTIFY).
- **`packages/shared`** — contratos zod + nomes dos canais NOTIFY.
- **`legacy/`** — MilesGuard original (**CommonJS**), só referência do porte. **Não evoluir.**

## Autenticação (ADR-0007 — substitui o Google OAuth do ADR-0005)

Login do **único dono** por **e-mail + senha** (sem provedor externo):

- `POST /api/auth/login` com `{ email, password }` → valida `email === AUTH_EMAIL` (default `leoferolive@gmail.com`)
  **E** `bcrypt.compare(password, AUTH_PASSWORD_HASH)`. Falha → **401 genérico** (`Credenciais inválidas.`).
- Sucesso → **JWT** de sessão (7 dias). Rotas protegidas via `requireAuth`; WS autentica por `?token=`.
- `/api/auth/login` tem **rate-limit estrito** (5 req/min/IP) além do global. Lib: **`bcryptjs`** (JS puro, arm64-safe).
- `AUTH_EMAIL` é configmap (não-secreto); `AUTH_PASSWORD_HASH` é **Secret** (em prod, obrigatório e não pode ser o
  hash default de dev — fail-fast no boot).

## Comandos

```bash
pnpm install              # instala o workspace
pnpm dev                  # turbo: dev de todos os apps
pnpm build                # turbo: build (libs → dist; web → vite)
pnpm type-check           # turbo: tsc --noEmit
pnpm test                 # turbo: vitest

docker compose up -d postgres                 # Postgres local
pnpm -C packages/db db:generate               # gera migration a partir do schema
pnpm -C packages/db db:migrate                # aplica migrations
pnpm format                                   # prettier --write
```

## Convenções

- **ESM** (`type: module`) em tudo; imports relativos com extensão `.js`.
- TypeScript **estrito**; libs (`packages/*`) buildam para `dist` e são consumidas via `@nossoradar/*` (`workspace:*`).
- Stack: pnpm + turbo, Fastify 5, Drizzle + postgres-js, React 19/Vite 6, Vitest, zod 3, `prom-client`.
- Segredos: k8s Secrets planos (fora do git). Login: `AUTH_EMAIL` (config) + `AUTH_PASSWORD_HASH` (Secret).
- Lint (eslint/oxlint) ainda **não** configurado; só `prettier`.

## Deploy / CI

- Duas imagens arm64: `ghcr.io/leoferolive/nossoradar-{worker,web}` (dev publica nos pacotes `-dev`).
  `Dockerfile.worker` = worker; `Dockerfile.web` = api + SPA (`node apps/api/dist/server.js`).
- Manifests **k8s crus** em `k8s/{dev,prod}` (sem Helm/Kustomize); Traefik + Cloudflare Tunnel (TLS na borda).
  `initContainer db-migrate` roda as migrations antes do app. Ver [`k8s/README.md`](./k8s/README.md).
- **CI = GitHub Actions** (`.github/workflows/`): `ci.yml` (build/type-check/test em `ubuntu-latest`); build/push
  das imagens arm64 em runners **hospedados `ubuntu-24.04-arm`** → GHCR → `kubectl` via Tailscale.
- Go-live / rollback: ver [`docs/CUTOVER.md`](./docs/CUTOVER.md).

## Gotchas

- **Worker é singleton rígido** (ADR-0004): duas conexões Baileys na mesma conta derrubam a sessão. Nunca
  HPA/KEDA/múltiplas réplicas; `connect()` é serializado para não abrir dois sockets.
- **Pareamento WhatsApp**: o worker tenta **5 reconexões** e então para com status `exhausted`. Para retomar, use
  o botão **"Gerar novo QR"** no Painel → `POST /api/connection/reconnect` (NOTIFY `reconnect_requested`).
  Reinícios normais reconectam pela Sessão do PVC, **sem novo QR**.
