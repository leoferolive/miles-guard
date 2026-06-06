# Deploy do nossoRadar no k3s (arm64)

Manifests YAML crus (sem Helm/Kustomize), padrão da casa
(`nossalista`/`nossagrana`/`chat-api`). Dois ambientes:

| Ambiente | Namespace        | Host                                | Pacotes GHCR (worker / web)                            | Tags          |
| -------- | ---------------- | ----------------------------------- | ------------------------------------------------------ | ------------- |
| dev      | `nossoradar-dev` | `nossoradar-dev.leoferolive.com.br` | `nossoradar-worker-dev` / `nossoradar-web-dev`         | `:dev`, RC    |
| prod     | `nossoradar`     | `nossoradar.leoferolive.com.br`     | `nossoradar-worker` / `nossoradar-web`                 | `:latest`, `vX.Y.Z` |

> **Pacotes GHCR separados por ambiente** (padrão da casa): dev publica nos
> pacotes `-dev` e prod nos pacotes sem sufixo. O prune de RC antigas só toca os
> pacotes `-dev`; os pacotes de prod **nunca** são podados (são o alvo de rollback).
> Cada build de prod empurra a tag semver **imutável** `vX.Y.Z` além de `:latest`.

## Workloads

- **postgres** — `StatefulSet` (1 réplica, `local-path`, 5Gi) + Service headless.
  Estado durável + barramento `LISTEN/NOTIFY` (ADR-0003, ADR-0006).
- **worker** — `Deployment` singleton (`replicas: 1`, `strategy: Recreate`) com PVC
  da Sessão WhatsApp montado em `/session` (ADR-0004). Nunca escalar (sem HPA/KEDA).
  Expõe `/healthz` e `/metrics` na porta 3001.
- **web** (Painel) — `Deployment` (Fastify servindo API + WS + login email/senha + SPA React).
  `initContainer` `db-migrate` roda as migrations Drizzle (mesma imagem) antes do app.
  Expõe `/healthz` e `/metrics` na porta 3000.
- **ingress** — Traefik (`entrypoints: web`, HTTP) → Service `nossoradar-web`. TLS
  terminado na borda pelo Cloudflare Tunnel.
- **observabilidade** — `ServiceMonitor` (label `release: kps`) raspa `/metrics` de web
  e worker; `PrometheusRule` alerta "worker desconectado do WhatsApp" e pods não-ready
  → AlertManager → Telegram de infra.

## Pré-requisitos (uma vez por namespace)

### 1. `ghcr-secret` (pull das imagens privadas do GHCR)

Precisa existir nos **DOIS** namespaces **antes do primeiro deploy** (o CI não o
cria) — `nossoradar` puxa os pacotes de prod, `nossoradar-dev` puxa os `-dev`:

```bash
for NS in nossoradar nossoradar-dev; do
  kubectl create secret docker-registry ghcr-secret \
    --namespace "$NS" \
    --docker-server=ghcr.io \
    --docker-username=leoferolive \
    --docker-password="$GHCR_PAT"   # PAT com escopo read:packages
done
```

### 2. Secrets da aplicação e do Postgres (NUNCA commitados)

Os arquivos `secret.template.yaml` são **modelo apenas** — não os aplique. Crie os
Secrets reais out-of-band (exemplos para prod; troque o namespace por
`nossoradar-dev` no dev):

```bash
# Gere o hash bcrypt da senha do dono (ADR-0007) ANTES — nunca guarde a senha em texto:
#   AUTH_PASSWORD_HASH=$(node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'SUASENHA')
kubectl create secret generic nossoradar-secrets \
  --namespace nossoradar \
  --from-literal=DATABASE_URL='postgresql://nossoradar:SENHA@nossoradar-postgres:5432/nossoradar' \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=AUTH_PASSWORD_HASH="$AUTH_PASSWORD_HASH" \
  --from-literal=TELEGRAM_BOT_TOKEN='...' \
  --from-literal=TELEGRAM_CHAT_ID='...'

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
| `AUTH_PASSWORD_HASH`                     | Hash bcrypt da senha do dono (ADR-0007); obrigatório em prod. Gere com `node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'SUASENHA'` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Bot do Telegram do usuário (Alerta de Detecção) |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Geradas aqui; reusadas no `DATABASE_URL` |

> `AUTH_EMAIL` (e-mail do dono) NÃO é segredo: vive no `nossoradar-config`
> (configmap), default `leoferolive@gmail.com`.

### 3. Senha do dono — hash bcrypt (ADR-0007)

O login é por e-mail + senha (sem provedor externo). Gere o **hash bcrypt** da senha
e coloque-o em `AUTH_PASSWORD_HASH` (Secret `nossoradar-secrets`) — **nunca** a senha
em texto:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'SUASENHA'
```

`AUTH_EMAIL` (default `leoferolive@gmail.com`) fica no `nossoradar-config`.

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

## Rollback de prod (reproduzível)

Cada deploy de prod empurra a tag semver **imutável** `vX.Y.Z` (além de `:latest`)
para os pacotes de prod, que **nunca** são podados. Logo, o rollback é apontar os
Deployments de volta para a tag boa anterior:

```bash
# Substitua vX.Y.Z pela última versão estável boa.
kubectl set image deployment/nossoradar-worker \
  worker=ghcr.io/leoferolive/nossoradar-worker:vX.Y.Z -n nossoradar
kubectl set image deployment/nossoradar-web \
  web=ghcr.io/leoferolive/nossoradar-web:vX.Y.Z -n nossoradar

kubectl rollout status deployment/nossoradar-worker -n nossoradar --timeout=300s
kubectl rollout status deployment/nossoradar-web    -n nossoradar --timeout=300s
```

> O dev nunca toca os pacotes de prod (publica e poda só os `-dev`), então a tag
> `vX.Y.Z` permanece disponível para rollback indefinidamente.

## Rotacionar segredos

```bash
kubectl edit secret nossoradar-secrets -n nossoradar
kubectl rollout restart deployment/nossoradar-web deployment/nossoradar-worker -n nossoradar
```
