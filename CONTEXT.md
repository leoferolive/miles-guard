# nossoRadar

Monitor web **single-user** de ofertas/alertas em grupos do WhatsApp. Evolução do MilesGuard: observa grupos
arbitrários, filtra por palavras-chave próprias de cada grupo e notifica no Telegram, com um painel web para
gestão (pareamento, grupos, keywords) e visualização (feed, histórico, estatísticas).

## Language

**Grupo Monitorado**:
Um grupo do WhatsApp acompanhado pelo app, identificado pelo seu **JID** e dono de uma lista própria de palavras-chave.
_Evitar_: subgrupo, comunidade, canal

**JID**:
O identificador interno estável de um grupo no WhatsApp (ex.: `12036...@g.us`), imune a renomeação.
_Evitar_: nome do grupo (como chave de identidade)

**Palavra-chave**:
Termo que, ao aparecer numa mensagem, sinaliza relevância; pertence a **um** Grupo Monitorado (não há lista global).
_Evitar_: filtro global, termo

**Detecção**:
O evento gerado quando uma mensagem de um Grupo Monitorado contém uma de suas Palavras-chave.
_Evitar_: oferta, match

**Alerta de Detecção**:
A notificação de uma Detecção enviada ao Telegram do Usuário — a feature do produto.
_Evitar_: alerta (sozinho, ambíguo), notificação

**Alerta de Infra**:
Alerta operacional (ex.: worker desconectou do WhatsApp) enviado ao Telegram pelo AlertManager; independe de mensagens.
_Evitar_: alerta (sozinho, ambíguo)

**Sessão WhatsApp**:
O estado de autenticação do Baileys (auth state) que mantém o app pareado a uma conta; persiste num volume.
_Evitar_: login, conta

**Worker**:
O processo singleton que mantém a Sessão WhatsApp e roda o filtro + dispatch.

**Painel**:
O processo web (Fastify + SPA React) que serve a API, o WebSocket e a autenticação.
_Evitar_: dashboard (é uma seção do Painel, não o app)

**Usuário**:
O dono — único — autenticado por Google OAuth + allowlist de e-mail.

## Relationships

- O **Usuário** (único) pareia uma **Sessão WhatsApp** (uma só).
- Um **Grupo Monitorado** é identificado por um **JID** e possui uma ou mais **Palavras-chave**.
- Uma mensagem que contém uma **Palavra-chave** do seu **Grupo Monitorado** de origem produz uma **Detecção**.
- Uma **Detecção** dispara um **Alerta de Detecção** (Telegram do Usuário) e é persistida para o histórico.
- Um **Alerta de Infra** nasce da observabilidade, não de uma **Detecção** — são coisas distintas.

## Example dialogue

> **Dev:** "Se a palavra 'oferta' estiver em dois **Grupos Monitorados**, uma mensagem num deles dispara **Detecção** no outro?"
> **Domain expert:** "Não. **Palavra-chave** pertence a um **Grupo Monitorado**, e o casamento usa o **JID** do grupo de origem. 'oferta' no grupo de eletrônicos não enxerga o grupo de passagens."
> **Dev:** "E o 'alerta' que chega no Telegram é o mesmo do 'worker caiu'?"
> **Domain expert:** "Não. O da oferta é **Alerta de Detecção** (a feature). 'Worker caiu' é **Alerta de Infra**, vem do AlertManager."

## Flagged ambiguities

- **"alerta"** era usado para o critério, para o evento e para ops — resolvido: o evento de casamento é a **Detecção**;
  a notificação dela ao Usuário é **Alerta de Detecção**; alertas operacionais são **Alerta de Infra**. Não existe
  entidade "Regra" separada — o critério **é** o Grupo Monitorado + suas Palavras-chave.
- **"oferta"** (herança de milhas) — generalizado para **Detecção**; o assunto pode ser qualquer um.
- Identificação de grupo por **nome** (modelo antigo, substring fuzzy) → por **JID** (estável).
- **"comunidade + subgrupos"** (modelo antigo, hierárquico e único) → lista plana de **Grupos Monitorados**.
