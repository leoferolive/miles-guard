# Reestruturar o MilesGuard em monorepo TypeScript, reaproveitando o core

O MilesGuard era um daemon CLI single-process em JavaScript (CommonJS). Decidimos reestruturá-lo num **monorepo
pnpm + turbo, TypeScript em tudo**, **reaproveitando a lógica do core** (conexão Baileys, filtro por palavra-chave,
dispatch/retry) portada para TS — em vez de recomeçar do zero ou manter o daemon. Motivo: o core já é genérico e
testado (é a parte difícil e arriscada — manter uma conexão WhatsApp estável), enquanto a mudança pedida
(frontend web + servidor) é aditiva.

## Considered Options

- **Recomeçar do zero** — descartado: jogaria fora a integração Baileys estável, a persistência de sessão, o retry
  queue e 143+ testes.
- **Manter JS e a estrutura atual, só acoplando um server** — descartado: maior acoplamento e sem tipos
  compartilhados entre frontend e backend num codebase que vai crescer bastante.
