# Postgres LISTEN/NOTIFY como barramento de eventos (sem Redis)

Usamos o **Postgres** como verdade durável **e** como barramento de eventos efêmeros (QR, status de conexão,
recarga de config, nova detecção) via **`LISTEN/NOTIFY`**, em vez de adicionar Redis ou outro broker. Motivo:
Postgres já é padrão da casa (nossagrana), enquanto o Redis seria a **única peça de infra nova** no homeserver
(Raspberry Pi, ARM com recursos limitados).

## Considered Options

- **Redis pub/sub** (decisão inicial, revista) — descartado ao descobrir que nenhum app real da casa usa Redis e
  que o Postgres cobre o caso com `LISTEN/NOTIFY`.
- Trade-off aceito: `NOTIFY` não persiste a mensagem do evento (ok, pois é efêmero) e o desacoplamento multi-host
  de um broker dedicado é abdicado em favor de menos peças para operar.
