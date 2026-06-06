# Cutover / Go-live do nossoRadar

Runbook **sequenciado** para colocar o nossoRadar no ar. Os comandos detalhados
(criação de secrets, apply, rollback, rotação) estão no [`k8s/README.md`](../k8s/README.md);
aqui está a **ordem das operações** e os **portões de validação**. Faça **dev primeiro**,
valide ponta a ponta, e só então promova para prod.

> Boa parte desta fase depende de você (acesso ao cluster, credenciais, celular para
> o QR). O que é seu está marcado com 🧑‍💻 e consolidado no fim.

## 0. Pré-requisitos (uma vez)

- 🧑‍💻 **GitHub** (Fase 6): criar os secrets `GHCR_PAT`, `KUBECONFIG` (base64) e
  `TAILSCALE_AUTHKEY`; criar o Environment `production` com required reviewers; ter o
  runner self-hosted `[self-hosted, Linux, ARM64]` registrado.
- 🧑‍💻 **Cluster** (ver `k8s/README.md` §Pré-requisitos): `ghcr-secret` nos **dois**
  namespaces; Secrets `nossoradar-secrets` + `nossoradar-postgres-secrets` (com
  `DATABASE_URL` casando as credenciais do Postgres); CRDs do kube-prometheus-stack.
- 🧑‍💻 **Senha do dono** (ADR-0007): gerar o **hash bcrypt** da senha e definir
  `AUTH_PASSWORD_HASH` no Secret `nossoradar-secrets` (prod e dev). Comando:
  ```bash
  node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" 'SUASENHA'
  ```
  O `AUTH_EMAIL` (default `leoferolive@gmail.com`) fica no `nossoradar-config` (não-secreto).
- 🧑‍💻 **Cloudflare Tunnel**: rotear os hosts `nossoradar[-dev].leoferolive.com.br`
  para o Traefik (TLS na borda).

## 1. Deploy em dev

Via CI (`deploy-branch-dev.yml`, dispatch) **ou** manual:
```bash
kubectl apply -f k8s/dev/
kubectl rollout status deployment/nossoradar-web    -n nossoradar-dev
kubectl rollout status deployment/nossoradar-worker -n nossoradar-dev
```
**Portão:** `initContainer db-migrate` conclui; ambos os pods `Ready`; o smoke test do
`k8s/README.md` (`/healthz` → ok; `/metrics` do worker com `nossoradar_worker_whatsapp_connected`).

## 2. Login no Painel

Abrir `https://nossoradar-dev.leoferolive.com.br` → **formulário e-mail + senha**
(ADR-0007). Entrar com `AUTH_EMAIL` + a senha cuja hash está em `AUTH_PASSWORD_HASH`.
**Portão:** credenciais corretas → entra; e-mail ou senha errados → **401**
(`Credenciais inválidas.`).

## 3. 🧑‍💻 Parear o WhatsApp

Tela **Conexão** → escanear o **QR** com o WhatsApp do celular.
**Portão:** status vira `connected`; `connection_state.status='connected'`. Reinicie o
pod do worker e confirme que ele **reconecta sem novo QR** (sessão no PVC, ADR-0004).

## 4. Cadastrar um Grupo Monitorado

Tela **Grupos** → **Buscar meus grupos** (dispara `refresh_groups` no worker) → marcar
um grupo por **JID** → adicionar uma palavra-chave.
**Portão:** o grupo aparece como monitorado; o worker loga "config recarregada".

## 5. Validação ponta a ponta (o teste de verdade)

Poste no grupo monitorado uma mensagem contendo a palavra-chave.
**Portão (tudo isto deve acontecer):**
- A **Detecção** aparece no **feed ao vivo** da tela Detecções (via WebSocket).
- Chega o **Alerta de Detecção** no seu **Telegram**.
- Há uma linha em `detections` (Postgres).
- Uma palavra-chave de **outro** grupo **não** dispara (isolamento por JID).

## 6. Promover para prod

`deploy-prod.yml` (dispatch com a tag `vX.Y.Z`) → aprovar o gate do Environment
`production`. Repetir os passos 2–5 no host de prod (`nossoradar.leoferolive.com.br`,
namespace `nossoradar`) — inclusive o **pareamento do QR em prod** (sessão própria).

## 7. Pós-go-live

- **Observabilidade:** confirmar no Grafana que `nossoradar-web`/`-worker` são raspados
  e que o alerta "worker desconectado" chega no Telegram de infra ao derrubar o worker.
- **Rollback** (se preciso): `k8s/README.md` §Rollback — apontar os Deployments para a
  tag semver imutável anterior.
- **Rotação de segredos:** `k8s/README.md` §Rotacionar segredos.

---

## 🧑‍💻 Depende exclusivamente de você (checklist)

- [ ] GitHub: secrets `GHCR_PAT` / `KUBECONFIG` / `TAILSCALE_AUTHKEY`, Environment `production`, runner ARM64.
- [ ] Cluster: `ghcr-secret` (2 namespaces), `nossoradar-secrets` (incl. `AUTH_PASSWORD_HASH`), `nossoradar-postgres-secrets`.
- [ ] Senha do dono: gerar o hash bcrypt e setar `AUTH_PASSWORD_HASH` (prod + dev).
- [ ] Cloudflare Tunnel: hosts `nossoradar[-dev].leoferolive.com.br` → Traefik.
- [ ] Telegram: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (bot do dono).
- [ ] Parear o WhatsApp (QR) — em dev e em prod.
- [ ] Validação ponta a ponta (passo 5).
