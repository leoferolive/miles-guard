# MilesGuard - TODO Completo

Este documento consolida todas as tarefas técnicas necessárias para implementar o MilesGuard seguindo as 6 fases de desenvolvimento.

## 📋 Visão Geral das Fases

| Fase | Objetivo | Status | Duração |
|------|----------|---------|---------|
| 1 | [Fundação](#fase-1---fundação-) | ⏳ Pendente | 3-5 dias |
| 2 | [Filtros e Configuração](#fase-2---filtros-e-configuração-) | ⏳ Pendente | 3-4 dias |
| 3 | [Notificações](#fase-3---notificações-) | ⏳ Pendente | 2-3 dias |
| 4 | [PM2 e Estabilidade](#fase-4---pm2-e-estabilidade-️) | ⏳ Pendente | 2 dias |
| 5 | [Refinamentos](#fase-5---refinamentos-) | ⏳ Pendente | 3-4 dias |
| 6 | [Raspberry Pi](#fase-6---raspberry-pi-) | ⏳ Pendente | 2-3 dias |

**Marco de MVP:** Fase 3 completa = Sistema funcional básico  
**Marco de Produção:** Fase 5 completa = Sistema robusto 24/7  
**Marco de Deploy Dedicado:** Fase 6 completa = Hardware independente

---

## FASE 1 - Fundação 🏗️

**Objetivo:** Estabelecer conexão WhatsApp e captura básica de mensagens

### 1.1 Setup do Projeto
- [ ] **Criar estrutura de pastas**
  - [ ] `src/core/` (whatsapp.js, logger.js, config.js)
  - [ ] `src/utils/` (session.js, helpers.js)
  - [ ] `logs/` e `sessions/`
  - [ ] `src/index.js` como entry point

- [ ] **Configurar package.json**
  - [ ] Scripts: start, dev, test
  - [ ] Dependencies: baileys, winston, dotenv, chalk, qrcode-terminal
  - [ ] Configurar "type": "commonjs"

- [ ] **Criar arquivo .env**
  - [ ] WA_SESSION_PATH=./sessions
  - [ ] WA_RECONNECT_ATTEMPTS=5
  - [ ] LOG_LEVEL=info, LOG_FILE=./logs/milesguard.log

### 1.2 Conexão WhatsApp
- [ ] **Implementar src/core/whatsapp.js**
  - [ ] makeWASocket() com configuração customizada
  - [ ] QR Code generation com qrcode-terminal
  - [ ] Event handlers: connection.update, messages.upsert
  - [ ] Reconnection logic com backoff exponencial

- [ ] **Sistema de sessão (src/utils/session.js)**
  - [ ] Salvar credenciais em sessions/auth_info_baileys/
  - [ ] Restaurar sessão automática no restart
  - [ ] Cleanup de sessões inválidas

- [ ] **Event handlers essenciais**
  - [ ] 'connection.update' → Status de conexão
  - [ ] 'creds.update' → Atualização de credenciais
  - [ ] 'messages.upsert' → Mensagens recebidas
  - [ ] 'groups.update' → Updates de grupos

### 1.3 Sistema de Logs
- [ ] **Configurar Winston (src/core/logger.js)**
  - [ ] Console transport com cores (chalk)
  - [ ] File transport para debug
  - [ ] Structured logging com timestamp
  - [ ] Níveis: error, warn, info, debug

- [ ] **Padrão de log estruturado**
  - [ ] { timestamp, level, component, event, data }
  - [ ] Logs específicos para WhatsApp events

### 1.4 Entry Point Principal
- [ ] **Implementar src/index.js**
  - [ ] Carregar configurações (.env)
  - [ ] Inicializar logger
  - [ ] Conectar ao WhatsApp
  - [ ] Setup de event listeners
  - [ ] Graceful shutdown handlers

### 1.5 Testes de Validação
- [ ] **Teste manual de conexão**
  - [ ] `npm start` → QR Code exibido
  - [ ] Scan → "Conectado! Monitorando mensagens..."
  - [ ] Mensagens de grupos aparecem no log

- [ ] **Teste de persistência**
  - [ ] Restart sem novo QR Code
  - [ ] Verificar sessão restaurada

### ✅ Critério de Sucesso Fase 1
```bash
$ npm start
> QR Code exibido no terminal
> Login realizado com sucesso
> "Conectado! Monitorando mensagens..."
> [14:32] Nova mensagem em "Passagens SUL": "Texto da mensagem"
```

---

## FASE 2 - Filtros e Configuração 🔍

**Objetivo:** Implementar sistema de filtros e wizard de configuração

### 2.1 Wizard Interativo
- [ ] **Instalar dependências**
  - [ ] inquirer ^12.9.4
  - [ ] zod ^4.1.5

- [ ] **Implementar src/core/wizard.js**
  - [ ] Detectar grupos WhatsApp disponíveis
  - [ ] Prompt de seleção de comunidade
  - [ ] Multi-select de subgrupos
  - [ ] Input de palavras-chave
  - [ ] Confirmação visual de configurações

- [ ] **Criar src/wizard.js (entry point)**
  - [ ] Script executável para configuração
  - [ ] `npm run config` command

### 2.2 Motor de Filtros
- [ ] **Implementar src/core/filter.js (FilterEngine)**
  - [ ] `shouldProcessMessage(message, groupName)`
  - [ ] `matchesKeywords(text)`
  - [ ] `isTargetGroup(groupName)`
  - [ ] `normalizeText()` - case insensitive, acentos

- [ ] **Algoritmo de match**
  - [ ] Grupo na lista de subgrupos monitorados
  - [ ] Texto contém pelo menos uma palavra-chave
  - [ ] Normalização completa de texto
  - [ ] Exclusão de mensagens de sistema

### 2.3 Sistema de Configuração
- [ ] **Schema validation (src/schemas/config.js)**
  - [ ] Zod schema para config.json
  - [ ] Validação de comunidade, subgrupos, palavras-chave
  - [ ] Default values (case_sensitive: false, rate_limit: 60)

- [ ] **Config Manager (src/core/config.js)**
  - [ ] `create(wizardData)` → salvar config.json
  - [ ] `load()` → carregar e validar
  - [ ] `reload()` → hot reload sem restart
  - [ ] `validate(config)` → schema validation

### 2.4 Integração com WhatsApp
- [ ] **Modificar src/core/whatsapp.js**
  - [ ] Integrar FilterEngine no messages.upsert
  - [ ] Log detalhado de matches/rejects
  - [ ] Preparar `processRelevantMessage()` para Fase 3

- [ ] **Group detection automático**
  - [ ] `sock.groupFetchAllParticipating()`
  - [ ] Lista de grupos para wizard

### 2.5 CLI Commands
- [ ] **Scripts NPM atualizados**
  - [ ] `npm run config` → Wizard
  - [ ] `npm run test-filter` → Testes
  - [ ] `npm run validate-config` → Validação

### 2.6 Testes
- [ ] **Test Suite (src/test/filter.js)**
  - [ ] Match de palavras-chave exato
  - [ ] Case insensitivity
  - [ ] Normalização de acentos
  - [ ] Filtro de grupos
  - [ ] Schema validation

### ✅ Critério de Sucesso Fase 2
```bash
$ npm run config
> Wizard completo → config.json válido gerado
$ npm run test-filter  
> Todos os testes de filtro passam
$ npm start
> Apenas mensagens relevantes são processadas e logadas
```

---

## FASE 3 - Notificações 📬

**Objetivo:** Sistema duplo de notificações (Telegram + Arquivos)

### 3.1 Integração Telegram
- [ ] **Configurar dependência**
  - [ ] node-telegram-bot-api ^0.66.0

- [ ] **Setup Bot (.env)**
  - [ ] TELEGRAM_BOT_TOKEN
  - [ ] TELEGRAM_CHAT_ID
  - [ ] TELEGRAM_RATE_LIMIT=30

- [ ] **Implementar src/core/telegram.js (TelegramNotifier)**
  - [ ] `sendNotification(message, options)`
  - [ ] `sendFormattedMessage(templateData)`
  - [ ] `formatMessage(relevantMessage)`
  - [ ] Rate limiting (30 msgs/min)
  - [ ] Error handling com fallback

- [ ] **Templates de mensagem**
  - [ ] Template padrão com grupo, remetente, hora, texto
  - [ ] Hashtags para palavras-chave encontradas
  - [ ] Formatação Markdown

### 3.2 Sistema de Arquivos
- [ ] **Implementar src/core/fileStorage.js**
  - [ ] `saveMessage(message)` → JSON por grupo/data
  - [ ] `saveDailySummary(date, messages)` → TXT legível
  - [ ] Estrutura: `logs/YYYY-MM-DD/grupo.json`
  - [ ] `cleanupOldLogs(retentionDays)`

- [ ] **JSON structure para mensagens**
  - [ ] Array de mensagens por grupo/data
  - [ ] Metadata: id, timestamp, sender, text, keywords
  - [ ] Summary: totalMessages, keywordStats

- [ ] **Resumo diário em TXT**
  - [ ] Estatísticas gerais e por grupo
  - [ ] Top palavras-chave
  - [ ] Horários de pico

### 3.3 Notification Dispatcher
- [ ] **Implementar src/core/notificationDispatcher.js**
  - [ ] `dispatch(relevantMessage)` → Telegram + File em paralelo
  - [ ] Error handling independente
  - [ ] Queue system para falhas
  - [ ] Retry com backoff exponencial

- [ ] **Rate limiting e Queue**
  - [ ] NotificationQueue para retry de falhas
  - [ ] Cooldown entre envios
  - [ ] Backup em arquivo quando Telegram falha

### 3.4 Templates de Notificação
- [ ] **Implementar src/core/templates.js**
  - [ ] `individual(data)` → Mensagem tempo real
  - [ ] `hourly(messages)` → Resumo horário (opcional)
  - [ ] `daily(summary)` → Compilado diário

### 3.5 Integração Completa
- [ ] **Modificar src/core/whatsapp.js**
  - [ ] Chamar `notificationDispatcher.dispatch()` para mensagens relevantes
  - [ ] Estrutura `relevantMessage` padronizada

- [ ] **Setup e Testes**
  - [ ] Script src/utils/setupBot.js
  - [ ] `npm run setup-bot`, `npm run get-chat-id`
  - [ ] `npm run test-notification`

### ✅ Critério de Sucesso Fase 3 (MVP)
```bash
$ npm run test-notification
> ✅ Telegram notification sent
> ✅ File saved to logs/2024-XX-XX/grupo.json

$ npm start  
> Mensagem relevante detectada → Telegram + arquivo salvos
> Sistema MVP funcional!
```

---

## FASE 4 - PM2 e Estabilidade ⚙️

**Objetivo:** Configuração para execução contínua e confiável

### 4.1 Configuração PM2
- [ ] **Instalar PM2**
  - [ ] pm2 ^5.3.0 como devDependency
  - [ ] Instalação global para produção

- [ ] **Criar ecosystem.config.js**
  - [ ] Configuração otimizada (1 instância, fork mode)
  - [ ] max_memory_restart: 200M
  - [ ] Auto-restart, logs rotativos
  - [ ] Variáveis de ambiente production

- [ ] **Scripts NPM para PM2**
  - [ ] npm run prod, stop, restart, logs, monit, status
  - [ ] npm run save, resurrect, startup

### 4.2 Health Checks
- [ ] **Implementar src/core/healthCheck.js**
  - [ ] checkWhatsAppConnection() - max 5min silêncio
  - [ ] checkMemoryUsage() - limite 200MB
  - [ ] checkDiskSpace() - espaço para logs
  - [ ] performFullCheck() - execução periódica

- [ ] **PM2 Ready Signal**
  - [ ] process.send('ready') após inicialização completa
  - [ ] wait_ready: true no ecosystem.config.js
  - [ ] Graceful shutdown handlers

### 4.3 Log Management
- [ ] **Winston com DailyRotateFile**
  - [ ] Rotação diária de logs
  - [ ] Arquivos separados para errors
  - [ ] Retenção configurável (14 dias)

- [ ] **PM2 log commands**
  - [ ] pm2 logs, flush, logs --json
  - [ ] Integração com logs da aplicação

### 4.4 Process Monitoring
- [ ] **Implementar src/core/processMonitor.js**
  - [ ] Métricas: messages processed, notifications sent, errors
  - [ ] System metrics: memory, CPU, uptime
  - [ ] Reporting periódico

- [ ] **Alert System**
  - [ ] Alertas via Telegram para situações críticas
  - [ ] Connection lost, high memory, too many restarts
  - [ ] Cooldown para evitar spam de alertas

### 4.5 Deployment Scripts
- [ ] **Script scripts/start.sh**
  - [ ] Verificar pré-requisitos (config.json, .env)
  - [ ] Criar diretórios necessários
  - [ ] PM2 startup setup

- [ ] **Health check script**
  - [ ] scripts/health-check.js
  - [ ] Verificações automatizadas
  - [ ] Exit codes para integração

### ✅ Critério de Sucesso Fase 4
```bash
$ npm run prod
> ✅ PM2 started successfully
> ✅ Health checks passing
> ✅ Process stable for 24h+ without intervention
```

---

## FASE 5 - Refinamentos ✨

**Objetivo:** Melhorias de qualidade de vida e usabilidade

### 5.1 Dashboard e UX
- [ ] **Status Dashboard (src/core/dashboard.js)**
  - [ ] generateReport() - uptime, stats, activity
  - [ ] Sistema de métricas consolidado

- [ ] **Resumo Diário Automático**
  - [ ] DailySummaryScheduler - envio às 22h
  - [ ] Resumo semanal segunda 9h
  - [ ] node-schedule para agendamento

- [ ] **Comandos Telegram Interativos**
  - [ ] /status - status do sistema
  - [ ] /stats - estatísticas detalhadas  
  - [ ] /today - ofertas de hoje
  - [ ] /help - comandos disponíveis

### 5.2 Filtros Dinâmicos
- [ ] **Dynamic Filter Controller**
  - [ ] pauseGroup(), resumeGroup()
  - [ ] pauseKeyword(), toggleGlobalPause()
  - [ ] Controle via Telegram sem restart

### 5.3 Otimizações Performance
- [ ] **Message Cache (src/core/messageCache.js)**
  - [ ] Cache inteligente anti-spam
  - [ ] TTL configurável, limpeza automática
  - [ ] Hash de mensagens para detecção duplicatas

- [ ] **Message Deduplicator**
  - [ ] Fingerprint de mensagens
  - [ ] Detecção de duplicatas em 30s
  - [ ] Cleanup automático

- [ ] **Performance Monitor**
  - [ ] Métricas de tempo de processamento
  - [ ] Stats: avg, min, max, p95
  - [ ] Reporting periódico

### 5.4 Log Management Avançado
- [ ] **Log Compression e Cleanup**
  - [ ] Compressão diária às 2h (gzip)
  - [ ] Cleanup semanal domingo 3h
  - [ ] Retenção configurável (30 dias)

### 5.5 Documentação
- [ ] **Criar docs/INSTALLATION.md**
  - [ ] Guia passo-a-passo completo
  - [ ] Pré-requisitos, setup Telegram
  - [ ] Troubleshooting comum

- [ ] **Criar docs/FAQ.md**
  - [ ] Perguntas frequentes
  - [ ] Limitações do WhatsApp
  - [ ] Backup e restore

- [ ] **Criar docs/EXAMPLES.md**
  - [ ] Configurações para diferentes cenários
  - [ ] Milhas/pontos, viagens, investimentos

### 5.6 Interface Melhorada
- [ ] **Rich Console Output**
  - [ ] Cores e formatação com chalk
  - [ ] Logs visuais para matches
  - [ ] Status indicators

- [ ] **Web Dashboard (opcional)**
  - [ ] Express server simples
  - [ ] /status, /logs, /config endpoints
  - [ ] Interface básica HTML

### ✅ Critério de Sucesso Fase 5
Sistema polido e robusto:
- ✅ UX superior com comandos Telegram
- ✅ Performance otimizada com cache
- ✅ Documentação completa
- ✅ Manutenção automatizada

---

## FASE 6 - Raspberry Pi 🥧

**Objetivo:** Deploy em hardware dedicado 24/7

### 6.1 Setup Hardware
- [ ] **Hardware mínimo**
  - [ ] Raspberry Pi 4 (2GB RAM mínimo)
  - [ ] MicroSD 32GB Class 10
  - [ ] Fonte 5V 3A, dissipador, case

- [ ] **Sistema Operacional**
  - [ ] Raspberry Pi OS Lite 64-bit
  - [ ] SSH habilitado, Wi-Fi configurado
  - [ ] Hostname: milesguard

### 6.2 Software Setup
- [ ] **Instalar Node.js 18 LTS**
  - [ ] Via NodeSource repository
  - [ ] npm install -g pm2

- [ ] **Dependências do sistema**
  - [ ] build-essential, python3-dev
  - [ ] Bibliotecas para Baileys
  - [ ] htop, git, curl para admin

### 6.3 Deploy da Aplicação
- [ ] **Transfer e setup**
  - [ ] Empacotar aplicação (tar.gz)
  - [ ] Transferir via scp
  - [ ] npm ci --only=production

- [ ] **Configuração ARM otimizada**
  - [ ] ecosystem.config.js específico Pi
  - [ ] max_memory_restart: 300M
  - [ ] NODE_OPTIONS: --max-old-space-size=256

### 6.4 Otimizações ARM
- [ ] **Memory Management (src/core/piMemoryManager.js)**
  - [ ] Monitoramento específico Pi
  - [ ] Warning: 250MB, Critical: 300MB
  - [ ] Force restart se crítico

- [ ] **Storage Optimization**
  - [ ] Batch writes para SD card
  - [ ] Reduzir wear com batching
  - [ ] Flush interval: 30s

- [ ] **Network Resilience**
  - [ ] Ping monitoring (30s)
  - [ ] Offline mode queue
  - [ ] Auto-reconnect inteligente

### 6.5 Startup Automático
- [ ] **Systemd Service**
  - [ ] /etc/systemd/system/milesguard.service
  - [ ] Auto-restart, resource limits
  - [ ] systemctl enable milesguard

- [ ] **Ou PM2 Startup**
  - [ ] pm2 startup, pm2 save
  - [ ] Boot-time initialization

- [ ] **Watchdog Script**
  - [ ] scripts/pi-watchdog.sh
  - [ ] Process + memory monitoring
  - [ ] Auto-restart logic

### 6.6 Backup e Manutenção
- [ ] **Local Backup**
  - [ ] scripts/backup.sh - tar.gz diário
  - [ ] Rotação de backups (7 dias)

- [ ] **Google Drive Sync (opcional)**
  - [ ] rclone configuration
  - [ ] scripts/sync-gdrive.sh
  - [ ] Upload automático

- [ ] **Cron Jobs**
  - [ ] Backup diário 3h
  - [ ] Sync 4h, restart semanal preventivo
  - [ ] Cleanup logs antigos

### 6.7 Monitoramento Remoto
- [ ] **Status API mínima**
  - [ ] Express server porta 3001
  - [ ] /status, /health endpoints
  - [ ] JSON com system info

- [ ] **Comandos Telegram específicos Pi**
  - [ ] /pi - status sistema (temp, disk, memory)
  - [ ] /restart - reiniciar app
  - [ ] /reboot - reiniciar Pi (autorizado)

### 6.8 Troubleshooting
- [ ] **Scripts diagnóstico**
  - [ ] scripts/pi-diagnostics.sh
  - [ ] Check completo: temp, memory, disk, network
  - [ ] Process status, recent logs

- [ ] **Problemas comuns**
  - [ ] SD card corruption → fsck
  - [ ] Overheating → vcgencmd measure_temp
  - [ ] Wi-Fi issues → wpa_cli reconfigure

### ✅ Critério de Sucesso Fase 6
Sistema 24/7 independente:
- ✅ Pi rodando MilesGuard continuamente
- ✅ Monitoramento remoto via Telegram
- ✅ Backup automático funcionando
- ✅ Consumo baixo de energia
- ✅ Manutenção mínima necessária

---

## 🎯 Marcos de Entrega

### 📍 MVP (Fase 3 completa)
- [x] Captura mensagens WhatsApp
- [x] Filtra por critérios configurados
- [x] Notifica no Telegram
- [x] Salva arquivos organizados
- **Status:** Sistema básico funcional ✅

### 📍 Produção (Fase 5 completa)  
- [x] Estável 24/7 com PM2
- [x] Health checks automáticos
- [x] Logs organizados e comprimidos
- [x] UX polido com comandos Telegram
- [x] Documentação completa
- **Status:** Sistema robusto para uso pessoal ✅

### 📍 Hardware Dedicado (Fase 6 completa)
- [x] Deploy em Raspberry Pi
- [x] Operação independente 24/7
- [x] Backup automático
- [x] Monitoramento remoto
- [x] Baixo consumo de energia
- **Status:** Solução completa e autônoma ✅

---

## 📊 Tracking de Progresso

### Como usar este TODO:
1. ✅ Marque itens completados com [x]
2. 🔄 Items em progresso com [~]
3. ❌ Items bloqueados com [!]
4. 📝 Adicione notas técnicas quando necessário

### Estimativa Total: 15-20 dias
- **Desenvolvimento:** 13-17 dias (fases 1-5)
- **Deploy Pi:** 2-3 dias (fase 6, opcional)
- **Buffer:** 20% para debugging e ajustes

### Dependencies Entre Fases:
- **Fase 2** depende de **Fase 1** (WhatsApp connection)
- **Fase 3** depende de **Fase 2** (filter system) 
- **Fase 4** depende de **Fase 3** (complete workflow)
- **Fases 5-6** são incrementais sobre base sólida

---

## 🔧 Comandos Úteis Durante Desenvolvimento

### Desenvolvimento
```bash
npm start              # Development mode
npm run config         # Configuration wizard
npm run test-filter    # Test filter system
npm run test-notification  # Test notifications
```

### Produção
```bash
npm run prod           # Start with PM2
npm run status         # Check PM2 status
npm run logs           # View logs
npm run restart        # Restart service
npm run health-check   # System health check
```

### Raspberry Pi
```bash
sudo systemctl status milesguard  # Service status
sudo journalctl -u milesguard -f  # Follow logs
vcgencmd measure_temp             # Check temperature
pm2 monit                         # Monitor resources
```

---

**📌 Nota:** Este TODO deve ser atualizado conforme o progresso das implementações, servindo como roadmap técnico detalhado para o desenvolvimento completo do MilesGuard.