# Single-user com login por e-mail + senha (substitui o Google OAuth)

Autenticação do **único dono** por **e-mail + senha**, substituindo o Google OAuth
reaproveitado do nossalista (ADR-0005). O e-mail válido é **um só**, configurável via
`AUTH_EMAIL` (default `leoferolive@gmail.com`). A senha **nunca** é guardada em texto:
validamos com `bcrypt.compare` contra um **hash bcrypt** fornecido por
`AUTH_PASSWORD_HASH` (Secret). Em sucesso emitimos o **mesmo JWT de sessão** de antes
(validade 7 dias, payload `{ sub, email }`) — o resto do app (requireAuth, WS `?token=`,
rotas protegidas, `/api/me`) permanece **idêntico**.

Motivo: o app é single-user e roda no homeserver do dono. O fluxo Google OAuth obrigava
manter uma credencial OAuth no Google Cloud, cadastrar redirect URIs por ambiente e
acoplar o login a um provedor externo — custo operacional desproporcional para **um**
usuário. Um par e-mail+senha (com o hash em Secret) elimina essa dependência e o passo
manual de console no go-live, mantendo o mesmo nível de controle de acesso (só o dono
entra).

## Decisão

- **Endpoint**: `POST /api/auth/login` com body `{ email, password }` (zod).
  Validação: `email` (normalizado p/ minúsculas) `=== AUTH_EMAIL` **E**
  `bcrypt.compare(password, AUTH_PASSWORD_HASH) === true`. Em qualquer falha → **401
  genérico** `{ message: "Credenciais inválidas." }` (não revela qual campo falhou; a
  senha é comparada mesmo com e-mail errado para não vazar timing/enumeração). Em
  sucesso: upsert do Usuário (nome derivado da parte local do e-mail) → JWT → `{ token, user }`.
- **Anti brute-force**: rate-limit **por-rota** estrito em `/api/auth/login`
  (5 req/min/IP via `@fastify/rate-limit`), além do limite global.
- **Lib**: `bcryptjs` (JS puro) em vez de `bcrypt` (nativo). O alvo de prod é **arm64**
  (Raspberry Pi/k3s); `bcrypt` exige prebuilds/node-gyp por arquitetura e quebra com
  frequência em arm64, enquanto `bcryptjs` não tem dependência nativa e é idêntico em
  qualquer plataforma. O custo de CPU extra é irrelevante para um login pontual single-user.
- **Fail-fast (env.ts)**: em produção, `AUTH_PASSWORD_HASH` é obrigatório e não pode ser
  o hash default de dev (caso contrário o boot aborta). `JWT_SECRET` mantém as regras
  anteriores. Em dev/test há um hash default (senha `dev`) para o app subir sem setup.
- **Gerar o hash** (operador, out-of-band):
  ```bash
  node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'SUASENHA'
  ```
  O valor resultante (`$2a$10$...`) vai em `AUTH_PASSWORD_HASH` (Secret).

## Considered Options

- **Manter Google OAuth + allowlist (ADR-0005)** — descartado: dependência externa e
  passo manual de console (redirect URIs por ambiente) sem ganho para um único usuário.
- **`bcrypt` nativo** — descartado pelo atrito de build em arm64 (ver acima).
- **Senha em texto em env** — descartado por segurança (nunca persistir a senha; só o hash).

## Consequências

- O frontend troca o botão "Entrar com Google" por um **formulário** e-mail+senha; a
  rota/página `/auth/callback` e o caminho "token-via-URL" deixam de existir.
- Some a dependência `@fastify/oauth2` e as variáveis `GOOGLE_CLIENT_ID`/
  `GOOGLE_CLIENT_SECRET`/`ALLOWED_EMAILS`; entram `AUTH_EMAIL` (configmap, não-secreto) e
  `AUTH_PASSWORD_HASH` (Secret).
- A tabela `users` permanece como está (upsert por e-mail) — **sem migração de schema**.

**Supersedes:** ADR-0005.
