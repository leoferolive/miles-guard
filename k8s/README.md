# Deploy do nossoRadar no k3s (arm64)

Manifests YAML crus (sem Helm/Kustomize), padrão da casa
(`nossalista`/`nossagrana`/`chat-api`). Dois ambientes:

| Ambiente | Namespace        | Host                                    | Tags de imagem |
| -------- | ---------------- | --------------------------------------- | -------------- |
| dev      | `nossoradar-dev` | `nossoradar-dev.leoferolive.com.br`     | `:dev`         |
| prod     | `nossoradar`     | `nossoradar.leoferolive.com.br`         | `:latest`      |

## Workloads

- **postgres** — `StatefulSet` (1 réplica, `local-path`, 5Gi) + Service headless.
  Estado durável + barramento `LISTEN/NOTIFY` (ADR-0003, ADR-0006).
- **worker** — `Deployment` singleton (`replicas: 1`, `strategy: Recreate`) com PVC
  da Sessão WhatsApp montado em `/session` (ADR-0004). Nunca escalar (sem HPA/KEDA).
  Expõe `/healthz` e `/metrics` na porta 3001.
- **web** (Painel) — `Deployment` (Fastify servindo API + WS + OAuth + SPA React).
  `initContainer` `db-migrate` roda as migrations Drizzle (mesma imagem) antes do app.
  Expõe `/healthz` e `/metrics` na porta 3000.
- **ingress** — Traefik (`entrypoints: web`, HTTP) → Service `nossoradar-web`. TLS
  terminado na borda pelo Cloudflare Tunnel.
- **observabilidade** — `ServiceMonitor` (label `release: kps`) raspa `/metrics` de web
  e worker; `PrometheusRule` alerta "worker desconectado do WhatsApp" e pods não-ready
  → AlertManager → Telegram de infra.

## Pré-requisitos (uma vez por namespace)

### 1. `ghcr-secret` (pull das imagens privadas do GHCR)

```bash
kubectl create secret docker-registry ghcr-secret \
  --namespace nossoradar \
  --docker-server=ghcr.io \
  --docker-username=leoferolive \
  --docker-password="$GHCR_PAT"   # PAT com escopo read:packages
# repita com --namespace nossoradar-dev para o ambiente de dev
```

### 2. Secrets da aplicação e do Postgres (NUNCA commitados)

Os arquivos `secret.template.yaml` são **modelo apenas** — não os aplique. Crie os
Secrets reais out-of-band (exemplos para prod; troque o namespace por
`nossoradar-dev` no dev):

```bash
kubectl create secret generic nossoradar-secrets \
  --namespace nossoradar \
  --from-literal=DATABASE_URL='postgresql://nossoradar:SENHA@nossoradar-postgres:5432/nossoradar' \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=GOOGLE_CLIENT_ID='...apps.googleusercontent.com' \
  --from-literal=GOOGLE_CLIENT_SECRET='...' \
  --from-literal=TELEGRAM_BOT_TOKEN='...' \
  --from-literal=TELEGRAM_CHAT_ID='...' \
  --from-literal=ALLOWED_EMAILS='leoferolive@gmail.com'

kubectl create secret generic nossoradar-postgres-secrets \
  --namespace nossoradar \
  --from-literal=POSTGRES_USER=nossoradar \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -base64 32) \
  --from-literal=POSTGRES_DB=nossoradar
```

> **`DATABASE_URL` deve casar** com `POSTGRES_USER`/`PASSWORD`/`DB`. O host é o
> Service do Postgres (`nossoradar-postgres`), porta 5432.

#### Valores que o operador precisa preencher

| Chave (Secret)                          | De onde vem |
| --------------------------------------- | ----------- |
| `DATABASE_URL`                          | Montar a partir das credenciais do Postgres abaixo |
| `JWT_SECRET`                            | `openssl rand -hex 32` (≥ 32 chars em prod — fail-fast no app) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Reaproveitar a credencial OAuth do **nossalista** (ADR-0005) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Bot do Telegram do usuário (Alerta de Detecção) |
| `ALLOWED_EMAILS`                        | E-mail(s) da allowlist; obrigatório e não-vazio em prod (ADR-0005) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Geradas aqui; reusadas no `DATABASE_URL` |

### 3. Google OAuth — redirect URIs

No Google Cloud Console, adicionar aos **Authorized redirect URIs** do OAuth Client:

- `https://nossoradar.leoferolive.com.br/api/auth/google/callback` (prod)
- `https://nossoradar-dev.leoferolive.com.br/api/auth/google/callback` (dev)

### 4. CRDs do Prometheus Operator (para `ServiceMonitor`/`PrometheusRule`)

Os manifests de observabilidade dependem das CRDs `monitoring.coreos.com/v1` do
**kube-prometheus-stack** (release `kps`). Já instaladas no homeserver; se ausentes,
o `kubectl apply` desses dois arquivos falha com "no matches for kind" — instale o
operador antes.

## Aplicar

```bash
# prod
kubectl apply -f k8s/prod/
# (o initContainer db-migrate roda as migrations no primeiro rollout)
kubectl rollout status deployment/nossoradar-web    -n nossoradar
kubectl rollout status deployment/nossoradar-worker -n nossoradar

# dev (mesma sequência, namespace nossoradar-dev)
kubectl apply -f k8s/dev/
```

> A ordem dos recursos no diretório não importa: o k8s reconcilia. Em um cluster
> novo, aplicar o namespace primeiro evita ruído (`kubectl apply -f k8s/prod/namespace.yaml`).

## Smoke test pós-deploy

```bash
# Painel sobe e responde healthz
kubectl -n nossoradar port-forward svc/nossoradar-web 8080:80 &
curl -f http://localhost:8080/healthz   # → {"status":"ok"}

# Worker expõe métricas (gauge de conexão WhatsApp)
kubectl -n nossoradar port-forward svc/nossoradar-worker 8081:3001 &
curl -s http://localhost:8081/metrics | grep nossoradar_worker_whatsapp_connected
```

Parear o WhatsApp pelo Painel (QR na tela de Conexão). Ao reiniciar o pod do worker,
ele reconecta usando a Sessão do PVC **sem novo QR** (ADR-0004).

## Rotacionar segredos

```bash
kubectl edit secret nossoradar-secrets -n nossoradar
kubectl rollout restart deployment/nossoradar-web deployment/nossoradar-worker -n nossoradar
```
