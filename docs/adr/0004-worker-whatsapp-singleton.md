# Worker WhatsApp como singleton (replicas:1 + Recreate + PVC de sessão)

O Deployment do `worker` roda com **`replicas: 1`** e **`strategy: Recreate`**, e a Sessão WhatsApp persiste num
**PVC**. Motivo: duas conexões Baileys na mesma conta causam conflito de sessão; um rolling update (dois pods
sobrepostos por instantes) derrubaria a conta. Isso é surpreendente porque outros componentes event-driven da casa
escalam (ex.: o `ingestion` do playground via KEDA) — o worker é a exceção deliberada.

## Consequences

- O worker **não pode** ser autoescalado (KEDA/HPA) nem ter múltiplas réplicas.
- Deploys e reinícios reconectam usando a Sessão do PVC, **sem exigir novo QR**.
