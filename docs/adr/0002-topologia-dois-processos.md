# Topologia de dois processos: worker WhatsApp + web

Separamos o runtime em **dois processos** — `worker` (mantém a Sessão WhatsApp via Baileys e roda filtro + dispatch)
e `web` (API + UI + auth). Escolhido **contra** a alternativa de processo único, a pedido do usuário, para isolar o
deploy/reinício do painel da conexão WhatsApp (que é cara: perdê-la pode exigir novo QR).

## Consequences

- O contrato entre os processos (via Postgres) vira **carga estrutural** — não há chamada direta worker↔web.
- Dois artefatos de deploy e dois ciclos de build/observação, em troca do isolamento.
