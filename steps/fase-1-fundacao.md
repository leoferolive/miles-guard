# FASE 1 - Fundação 🏗️

**Duração:** 3-5 dias  
**Objetivo:** Estabelecer conexão com WhatsApp e captura básica de mensagens

## 1. Setup do Projeto

### Estrutura de Pastas
```
MilesGuard/
├── src/
│   ├── core/
│   │   ├── whatsapp.js
│   │   ├── logger.js
│   │   └── config.js
│   ├── utils/
│   │   ├── session.js
│   │   └── helpers.js
│   └── index.js
├── logs/
├── sessions/
├── .env
└── ecosystem.config.js
```

### Dependências Técnicas
```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^6.7.19",
    "winston": "^3.17.0",
    "dotenv": "^17.2.2",
    "chalk": "^5.6.0",
    "qrcode-terminal": "^0.12.0"
  }
}
```

### Scripts NPM
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node src/test/connection.js"
  }
}
```

## 2. Conexão WhatsApp

### Implementação Core (`src/core/whatsapp.js`)
```javascript
// Funcionalidades principais:
- makeWASocket() com configuração customizada
- Gerenciamento de estado de conexão
- QR Code generation com qrcode-terminal
- Event handlers para messages.upsert
- Reconnection logic com backoff exponencial
```

### Sistema de Sessão (`src/utils/session.js`)
```javascript
// Recursos de persistência:
- Salvar credenciais em sessions/auth_info_baileys/
- Restaurar sessão automática no restart
- Cleanup de sessões inválidas
- Validação de integridade da sessão
```

### Configurações Ambientais (`.env`)
```env
# WhatsApp
WA_SESSION_PATH=./sessions
WA_RECONNECT_ATTEMPTS=5
WA_RECONNECT_DELAY=5000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/milesguard.log

# Debug
DEBUG_MODE=true
```

## 3. Sistema de Logs Básico

### Logger Configuration (`src/core/logger.js`)
```javascript
// Winston setup com:
- Console transport com cores (chalk)
- File transport para debug
- Rotation de logs diários
- Formatação structured logging
- Diferentes níveis: error, warn, info, debug
```

### Estrutura de Log
```javascript
// Padrões de log:
{
  timestamp: "2024-01-20T14:32:15.123Z",
  level: "info",
  component: "whatsapp",
  event: "message_received",
  data: {
    groupName: "Passagens SUL",
    sender: "João Silva",
    messageLength: 156
  }
}
```

## 4. Implementação Principal

### Entry Point (`src/index.js`)
```javascript
// Fluxo principal:
1. Carregar configurações (.env)
2. Inicializar logger
3. Conectar ao WhatsApp
4. Setup de event listeners
5. Manter processo vivo
6. Graceful shutdown handlers
```

### Event Handlers
```javascript
// Eventos essenciais:
- 'connection.update' -> Status de conexão
- 'creds.update' -> Atualização de credenciais
- 'messages.upsert' -> Mensagens recebidas
- 'groups.update' -> Updates de grupos
```

## 5. Testes de Validação

### Critérios de Sucesso
```bash
$ npm start
> QR Code exibido no terminal
> Scan com WhatsApp mobile
> "Conectado! Monitorando mensagens..."
> [14:32] Nova mensagem em "Passagens SUL": "Texto da mensagem"
```

### Testes Manuais
1. **Conexão Inicial:** QR Code → Conexão bem-sucedida
2. **Persistência:** Restart sem novo QR Code
3. **Captura:** Mensagens de grupos monitorados aparecem no log
4. **Reconexão:** Simular desconexão e verificar reconnect automático

### Debug e Troubleshooting
```javascript
// Pontos de debug críticos:
- Status de conexão (open/close/connecting)
- Validação de sessão existente
- Rate limits da API WhatsApp
- Parsing de mensagens recebidas
```

## 6. Outputs Esperados

### Console Output
```
[14:30:01] INFO  WhatsApp connecting...
[14:30:02] INFO  QR Code gerado - escaneie com seu celular
[14:30:15] INFO  Conectado com sucesso!
[14:30:16] INFO  Monitorando 0 grupos ativos
[14:32:45] INFO  Nova mensagem capturada
           └─ Grupo: Passagens SUL
           └─ Remetente: João Silva
           └─ Conteúdo: Pessoal, 100% de bônus...
```

### File Outputs
- `logs/milesguard.log` - Log estruturado
- `sessions/auth_info_baileys/` - Sessão persistida

## 7. Próximos Passos

Esta fase estabelece a fundação para:
- **Fase 2:** Sistema de filtros (usar os dados capturados aqui)
- **Fase 3:** Notificações (usar estrutura de eventos)
- **Fase 4:** PM2 (usar o processo principal criado)

### Handoffs para Fase 2
- Event handler `messages.upsert` preparado para receber filtros
- Logger configurado para registrar matches de filtros
- Estrutura de configuração pronta para config.json