# FASE 3 - Notificações 📬

**Duração:** 2-3 dias  
**Objetivo:** Implementar sistema duplo de notificações (Telegram + Arquivos)

## 1. Integração Telegram

### Dependencies
```json
{
  "dependencies": {
    "node-telegram-bot-api": "^0.66.0"
  }
}
```

### Bot Setup e Configuração

#### Configurações (.env)
```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
TELEGRAM_RATE_LIMIT=30  # mensagens por minuto
TELEGRAM_MAX_MESSAGE_LENGTH=4096

# Fallback
FALLBACK_NOTIFICATION=file  # file | console | none
```

#### Telegram Manager (`src/core/telegram.js`)
```javascript
class TelegramNotifier {
  constructor(token, chatId) {
    this.bot = new TelegramApi(token, { polling: false });
    this.chatId = chatId;
    this.rateLimiter = new RateLimiter(30, 60000); // 30 msg/min
  }
  
  // Métodos principais:
  async sendNotification(message, options = {})
  async sendFormattedMessage(templateData)
  async testConnection()
  formatMessage(relevantMessage)
  handleRateLimit()
  handleError(error, fallback)
}
```

### Message Formatting
```javascript
// Template de notificação padrão:
const formatTelegramMessage = (data) => `
🎯 *Nova Oferta Detectada!*

📱 *Grupo:* ${data.groupName}
👤 *De:* ${data.senderName}
🕐 *Hora:* ${formatTime(data.timestamp)}

💬 *Mensagem:*
"${truncateMessage(data.text, 200)}"

🏷️ *Palavras-chave encontradas:* ${data.matchedKeywords.map(k => `#${k}`).join(' ')}

━━━━━━━━━━━━━━━━━
`;
```

### Rate Limiting e Error Handling
```javascript
// Sistema de rate limiting:
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.requests = [];
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  
  async attempt(fn) {
    if (this.canProceed()) {
      return await fn();
    } else {
      throw new RateLimitError('Rate limit exceeded');
    }
  }
}

// Fallback em caso de erro:
- Telegram indisponível → Salvar em arquivo de backup
- Rate limit excedido → Queue mensagens para envio posterior
- Erro de rede → Retry com backoff exponencial
```

## 2. Sistema de Arquivos

### File Storage Manager (`src/core/fileStorage.js`)
```javascript
class FileStorageManager {
  constructor(basePath = './logs') {
    this.basePath = basePath;
    this.ensureDirectoryStructure();
  }
  
  // Métodos principais:
  async saveMessage(message)
  async saveDailySummary(date, messages)
  async getMessagesForDate(date)
  async cleanupOldLogs(retentionDays = 30)
  createDirectoryStructure(date)
  getFilePathForGroup(date, groupName)
}
```

### Estrutura de Diretórios
```javascript
// Organização automática:
logs/
├── 2024-01-20/
│   ├── passagens-sul.json
│   ├── compra-de-pontos.json
│   ├── transferencias.json
│   └── resumo-diario.txt
├── 2024-01-21/
│   └── ...
└── backups/
    ├── telegram-failures.json
    └── system-logs.json
```

### JSON Structure para Mensagens
```json
{
  "date": "2024-01-20",
  "group": "Passagens SUL",
  "messages": [
    {
      "id": "msg_123456",
      "timestamp": "2024-01-20T14:32:15.123Z",
      "sender": "João Silva",
      "text": "Pessoal, 100% de bônus na transferência para Latam até amanhã!",
      "matchedKeywords": ["100%", "latam"],
      "telegramSent": true,
      "telegramTimestamp": "2024-01-20T14:32:17.456Z"
    }
  ],
  "summary": {
    "totalMessages": 1,
    "keywordStats": {
      "100%": 1,
      "latam": 1
    }
  }
}
```

### Resumo Diário (TXT)
```
================================
MILESGUARD - RESUMO DIÁRIO
Data: 20/01/2024
================================

📊 ESTATÍSTICAS GERAIS:
• Total de ofertas: 5
• Grupos ativos: 3
• Notificações enviadas: 5

🎯 POR GRUPO:
┌─ Passagens SUL (2 ofertas)
├─ Compra de Pontos (2 ofertas)  
└─ Transferências (1 oferta)

🏷️ PALAVRAS-CHAVE MAIS COMUNS:
• "100%" - 3 vezes
• "latam" - 2 vezes
• "bônus" - 2 vezes

⏰ HORÁRIOS DE PICO:
• 09:00-12:00 - 3 ofertas
• 14:00-17:00 - 2 ofertas
```

## 3. Templates de Notificação

### Template Engine (`src/core/templates.js`)
```javascript
class NotificationTemplates {
  static individual(data) {
    // Mensagem individual padrão
  }
  
  static hourly(messages) {
    // Resumo de última hora
  }
  
  static daily(summary) {
    // Compilado do dia
  }
  
  static custom(template, data) {
    // Template customizável
  }
}
```

### Diferentes Tipos de Notificação

#### 1. Individual (Tempo Real)
```javascript
// Enviada imediatamente quando mensagem relevante é detectada
const message = formatIndividualNotification({
  groupName: "Passagens SUL",
  senderName: "João Silva", 
  text: "100% bônus Latam...",
  matchedKeywords: ["100%", "latam"],
  timestamp: new Date()
});
```

#### 2. Resumo Horário (Opcional)
```javascript
// A cada hora, se houver >= 3 mensagens
const hourlySummary = formatHourlySummary({
  hour: "14:00-15:00",
  totalMessages: 5,
  topKeywords: ["100%", "latam"],
  groups: ["Passagens SUL", "Compra de Pontos"]
});
```

#### 3. Compilado Diário
```javascript
// Enviado às 22:00 todos os dias
const dailySummary = formatDailySummary({
  date: "20/01/2024",
  totalMessages: 12,
  topOffers: [...],
  statistics: {...}
});
```

## 4. Notification Dispatcher

### Core Dispatcher (`src/core/notificationDispatcher.js`)
```javascript
class NotificationDispatcher {
  constructor() {
    this.telegram = new TelegramNotifier();
    this.fileStorage = new FileStorageManager();
    this.queue = new NotificationQueue();
  }
  
  async dispatch(relevantMessage) {
    const tasks = [
      this.sendTelegram(relevantMessage),
      this.saveToFile(relevantMessage)
    ];
    
    // Executar em paralelo com error handling independente
    const results = await Promise.allSettled(tasks);
    this.logResults(results);
  }
  
  async sendTelegram(message) {
    try {
      await this.telegram.sendFormattedMessage(message);
      logger.info('Telegram notification sent', { messageId: message.id });
    } catch (error) {
      await this.handleTelegramError(error, message);
    }
  }
  
  async saveToFile(message) {
    await this.fileStorage.saveMessage(message);
    logger.info('Message saved to file', { 
      group: message.groupName,
      date: formatDate(message.timestamp)
    });
  }
}
```

### Queue System para Falhas
```javascript
// Sistema de fila para retry de notificações:
class NotificationQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }
  
  async add(notification, retryCount = 0) {
    this.queue.push({ notification, retryCount, addedAt: Date.now() });
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    // Processar fila com backoff exponencial
  }
}
```

## 5. Integração com Fases Anteriores

### Update WhatsApp Handler
```javascript
// Modificar em src/core/whatsapp.js:
sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const message of messages) {
    // ... lógica de filtro da Fase 2
    
    if (filterEngine.shouldProcessMessage(message, groupName)) {
      const relevantMessage = {
        id: message.key.id,
        groupName: getGroupName(message),
        senderName: message.pushName,
        text: getMessageText(message),
        timestamp: new Date(message.messageTimestamp * 1000),
        matchedKeywords: filterEngine.getMatchedKeywords(messageText)
      };
      
      // NOVO: Disparar notificações
      await notificationDispatcher.dispatch(relevantMessage);
    }
  }
});
```

## 6. Configuração e Setup

### Bot Setup Script (`src/utils/setupBot.js`)
```javascript
// Script auxiliar para configurar bot do Telegram:
#!/usr/bin/env node
import TelegramBot from 'node-telegram-bot-api';

async function setupTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env');
    return;
  }
  
  const bot = new TelegramBot(token, { polling: false });
  
  try {
    const me = await bot.getMe();
    console.log(`✅ Bot conectado: @${me.username}`);
    
    console.log('📱 Para obter seu Chat ID:');
    console.log('1. Envie uma mensagem para o bot');
    console.log('2. Execute: npm run get-chat-id');
  } catch (error) {
    console.error('❌ Erro ao conectar bot:', error.message);
  }
}

setupTelegramBot();
```

### Scripts NPM Update
```json
{
  "scripts": {
    "setup-bot": "node src/utils/setupBot.js",
    "get-chat-id": "node src/utils/getChatId.js",
    "test-notification": "node src/test/notification.js"
  }
}
```

## 7. Testes e Validação

### Test Suite (`src/test/notification.js`)
```javascript
// Testes automatizados:
describe('Notification System', () => {
  test('Telegram message formatting');
  test('File storage with date organization');
  test('Rate limiting behavior');
  test('Error fallback mechanisms');
  test('Queue system for retries');
  test('Daily summary generation');
});
```

### Manual Testing
```bash
# Testar conexão Telegram
$ npm run setup-bot
> Bot conectado ✓

# Obter Chat ID
$ npm run get-chat-id  
> Chat ID: 123456789 ✓

# Testar notificação
$ npm run test-notification
> Telegram enviado ✓
> Arquivo salvo ✓
```

## 8. Monitoramento e Logs

### Métricas de Notificação
```javascript
// Rastreamento de performance:
const metrics = {
  telegramSent: 0,
  telegramFailed: 0,
  filesSaved: 0,
  queueSize: 0,
  avgResponseTime: 0,
  dailyMessages: 0
};
```

### Error Logging
```javascript
// Logs estruturados para debugging:
logger.error('Telegram notification failed', {
  error: error.message,
  messageId: message.id,
  retryCount: 3,
  fallbackUsed: 'file'
});
```

## 9. Outputs da Fase

### Funcionalidades Completas
- ✅ Notificações Telegram em tempo real
- ✅ Organização automática de arquivos por data/grupo
- ✅ Sistema de fallback para falhas
- ✅ Rate limiting inteligente
- ✅ Queue system para retry
- ✅ Templates de notificação flexíveis
- ✅ Resumos diários automáticos

### Arquivos Criados
- `src/core/telegram.js` - Gerenciador Telegram
- `src/core/fileStorage.js` - Sistema de arquivos
- `src/core/notificationDispatcher.js` - Dispatcher principal
- `src/core/templates.js` - Templates de mensagem
- `src/utils/setupBot.js` - Setup do bot

## 10. Preparação para Fase 4

Neste ponto o MVP está funcional:
- ✅ Captura mensagens WhatsApp
- ✅ Filtra por critérios configurados
- ✅ Notifica no Telegram
- ✅ Salva arquivos organizados

A Fase 4 focará em estabilidade 24/7 com PM2 e monitoramento.