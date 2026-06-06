# Single-user com Google OAuth reaproveitado + allowlist de e-mail

> **Superseded by [ADR-0007](0007-auth-email-senha.md)** — o login passou a ser por
> e-mail + senha (hash bcrypt via Secret). Este ADR fica como registro histórico.

Autenticação via **Google OAuth2 reaproveitando a credencial do nossalista** (adicionando o redirect URI do
nossoRadar ao mesmo OAuth Client do Google Cloud e compartilhando `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), porém
com uma **allowlist de e-mail** (`ALLOWED_EMAILS`) que o nossalista **não** tem. Motivo: o painel controla a conta de
WhatsApp do dono — replicar o cadastro aberto do nossalista (qualquer conta Google vira usuário) exporia esse
controle a qualquer pessoa na internet. A checagem `email ∈ ALLOWED_EMAILS` no callback é a trava que falta no
nossalista.

## Considered Options

- **Multi-tenant** (cada usuário pareia o próprio WhatsApp) — descartado: N sessões Baileys/mesmo IP aumentam muito
  o risco de bloqueio das contas pelo WhatsApp, pesam na RAM do Pi e ampliam o raio de explosão de um vazamento.
- **Replicar o nossalista sem allowlist** — descartado por segurança (painel sensível, não app colaborativo).
