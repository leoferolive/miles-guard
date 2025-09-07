# FASE 5 - Refinamentos ✨

**Duração:** 3-4 dias  
**Objetivo:** Melhorias de qualidade de vida e usabilidade

## 1. Melhorias de UX

### Dashboard Status (`src/core/dashboard.js`)
```javascript
class StatusDashboard {
  constructor() {
    this.stats = {
      uptime: Date.now(),
      messagesProcessed: 0,
      notificationsSent: 0,
      lastMessage: null,
      connectionStatus: 'unknown'
    };
  }
  
  generateReport() {
    const uptimeHours = (Date.now() - this.stats.uptime) / (1000 * 60 * 60);
    
    return {
      system: {
        uptime: `${uptimeHours.toFixed(1)}h`,
        status: this.stats.connectionStatus,
        memory: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`
      },
      activity: {
        messagesProcessed: this.stats.messagesProcessed,
        notificationsSent: this.stats.notificationsSent,
        lastActivity: this.stats.lastMessage ? 
          new Date(this.stats.lastMessage).toLocaleString() : 'Never'
      },
      daily: this.getDailyStats()
    };
  }
}
```

### Resumo Diário Automático
```javascript
// Sistema de resumo diário às 22h
class DailySummaryScheduler {
  constructor(notificationDispatcher) {
    this.dispatcher = notificationDispatcher;
    this.setupSchedule();
  }
  
  setupSchedule() {
    const schedule = require('node-schedule');
    
    // Todo dia às 22:00
    schedule.scheduleJob('0 22 * * *', async () => {
      await this.generateAndSendDailySummary();
    });
    
    // Resumo semanal às segundas 09:00
    schedule.scheduleJob('0 9 * * 1', async () => {
      await this.generateWeeklySummary();
    });
  }
  
  async generateAndSendDailySummary() {
    const today = new Date().toISOString().split('T')[0];
    const messages = await this.loadDayMessages(today);
    
    if (messages.length === 0) {
      return; // Não enviar se não houver atividade
    }
    
    const summary = this.buildDailySummary(messages);
    await this.dispatcher.sendTelegramSummary(summary);
  }
  
  buildDailySummary(messages) {
    const groupStats = {};
    const keywordStats = {};
    
    messages.forEach(msg => {
      // Estatísticas por grupo
      if (!groupStats[msg.groupName]) {
        groupStats[msg.groupName] = 0;
      }
      groupStats[msg.groupName]++;
      
      // Estatísticas por palavra-chave
      msg.matchedKeywords.forEach(keyword => {
        if (!keywordStats[keyword]) {
          keywordStats[keyword] = 0;
        }
        keywordStats[keyword]++;
      });
    });
    
    return {
      date: new Date().toLocaleDateString('pt-BR'),
      totalOffers: messages.length,
      groups: groupStats,
      keywords: keywordStats,
      peakHours: this.calculatePeakHours(messages)
    };
  }
}
```

### Comando /status no Telegram
```javascript
// Bot interativo para status via Telegram
class TelegramCommands {
  constructor(bot, dashboard) {
    this.bot = bot;
    this.dashboard = dashboard;
    this.setupCommands();
  }
  
  setupCommands() {
    // Comando /status
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const report = this.dashboard.generateReport();
      
      const statusMessage = `
🤖 *MilesGuard Status*

📊 *Sistema*
• Uptime: ${report.system.uptime}
• Status: ${report.system.status}
• Memória: ${report.system.memory}

📈 *Atividade*
• Mensagens processadas: ${report.activity.messagesProcessed}
• Notificações enviadas: ${report.activity.notificationsSent}
• Última atividade: ${report.activity.lastActivity}

📅 *Hoje*
• Ofertas capturadas: ${report.daily.offers}
• Grupos ativos: ${report.daily.activeGroups}
      `;
      
      await this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
    });
    
    // Comando /stats
    this.bot.onText(/\/stats/, async (msg) => {
      await this.sendDetailedStats(msg.chat.id);
    });
    
    // Comando /help
    this.bot.onText(/\/help/, async (msg) => {
      const helpMessage = `
🆘 *MilesGuard Commands*

/status - Status do sistema
/stats - Estatísticas detalhadas
/today - Ofertas de hoje
/config - Configuração atual
/help - Esta mensagem
      `;
      
      await this.bot.sendMessage(msg.chat.id, helpMessage, { parse_mode: 'Markdown' });
    });
  }
}
```

### Dynamic Filter Toggle
```javascript
// Sistema para ligar/desligar filtros sem restart
class DynamicFilterController {
  constructor(filterEngine) {
    this.filterEngine = filterEngine;
    this.pausedGroups = new Set();
    this.pausedKeywords = new Set();
    this.globalPause = false;
  }
  
  pauseGroup(groupName) {
    this.pausedGroups.add(groupName);
    logger.info(`Group paused: ${groupName}`);
  }
  
  resumeGroup(groupName) {
    this.pausedGroups.delete(groupName);
    logger.info(`Group resumed: ${groupName}`);
  }
  
  pauseKeyword(keyword) {
    this.pausedKeywords.add(keyword);
    logger.info(`Keyword paused: ${keyword}`);
  }
  
  toggleGlobalPause() {
    this.globalPause = !this.globalPause;
    logger.info(`Global filtering ${this.globalPause ? 'paused' : 'resumed'}`);
  }
  
  shouldProcessMessage(message, groupName) {
    if (this.globalPause) return false;
    if (this.pausedGroups.has(groupName)) return false;
    
    const originalResult = this.filterEngine.shouldProcessMessage(message, groupName);
    if (!originalResult) return false;
    
    // Verificar palavras-chave pausadas
    const matchedKeywords = this.filterEngine.getMatchedKeywords(message.text);
    const activekeywords = matchedKeywords.filter(k => !this.pausedKeywords.has(k));
    
    return activekeywords.length > 0;
  }
}
```

## 2. Otimizações

### Cache System
```javascript
// Cache inteligente para evitar processamento redundante
class MessageCache {
  constructor(maxSize = 1000, ttlMs = 60000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMs;
    this.setupCleanup();
  }
  
  generateKey(message) {
    // Chave baseada em conteúdo + grupo + tempo (minuto)
    const minute = Math.floor(Date.now() / 60000);
    return `${message.groupId}-${this.hashMessage(message.text)}-${minute}`;
  }
  
  hashMessage(text) {
    // Hash simples para detectar mensagens similares
    return text.toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 50);
  }
  
  isDuplicate(message) {
    const key = this.generateKey(message);
    
    if (this.cache.has(key)) {
      logger.debug('Duplicate message detected', { key });
      return true;
    }
    
    this.cache.set(key, {
      timestamp: Date.now(),
      text: message.text.substring(0, 100)
    });
    
    return false;
  }
  
  setupCleanup() {
    // Limpeza a cada 5 minutos
    setInterval(() => {
      const now = Date.now();
      const toDelete = [];
      
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.ttl) {
          toDelete.push(key);
        }
      }
      
      toDelete.forEach(key => this.cache.delete(key));
      
      // Limitar tamanho máximo
      if (this.cache.size > this.maxSize) {
        const keys = Array.from(this.cache.keys());
        const toRemove = keys.slice(0, keys.length - this.maxSize);
        toRemove.forEach(key => this.cache.delete(key));
      }
      
    }, 5 * 60 * 1000);
  }
}
```

### Message Deduplication
```javascript
// Sistema avançado de deduplicação
class MessageDeduplicator {
  constructor() {
    this.recentMessages = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
  }
  
  isDuplicate(message) {
    const fingerprint = this.createFingerprint(message);
    const now = Date.now();
    
    if (this.recentMessages.has(fingerprint)) {
      const stored = this.recentMessages.get(fingerprint);
      
      // Se foi processada há menos de 30 segundos, é duplicata
      if (now - stored.timestamp < 30000) {
        logger.debug('Duplicate detected', { 
          fingerprint,
          timeDiff: now - stored.timestamp 
        });
        return true;
      }
    }
    
    this.recentMessages.set(fingerprint, {
      timestamp: now,
      groupName: message.groupName
    });
    
    return false;
  }
  
  createFingerprint(message) {
    // Criar fingerprint baseado em características da mensagem
    const text = message.text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s%]/g, '')
      .trim();
    
    return `${message.groupName}:${text.substring(0, 100)}`;
  }
  
  cleanup() {
    const now = Date.now();
    const cutoff = 10 * 60 * 1000; // 10 minutos
    
    for (const [key, value] of this.recentMessages.entries()) {
      if (now - value.timestamp > cutoff) {
        this.recentMessages.delete(key);
      }
    }
  }
}
```

### Log Compression e Cleanup
```javascript
// Sistema automatizado de limpeza de logs
class LogManager {
  constructor(logsPath = './logs') {
    this.logsPath = logsPath;
    this.setupAutomatedCleanup();
  }
  
  setupAutomatedCleanup() {
    const schedule = require('node-schedule');
    
    // Compressão diária às 02:00
    schedule.scheduleJob('0 2 * * *', async () => {
      await this.compressOldLogs();
    });
    
    // Limpeza semanal aos domingos 03:00
    schedule.scheduleJob('0 3 * * 0', async () => {
      await this.cleanupOldFiles();
    });
  }
  
  async compressOldLogs() {
    const fs = require('fs').promises;
    const path = require('path');
    const zlib = require('zlib');
    
    try {
      const files = await fs.readdir(this.logsPath);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      for (const file of files) {
        if (file.includes(yesterdayStr) && !file.endsWith('.gz')) {
          const filePath = path.join(this.logsPath, file);
          const compressedPath = `${filePath}.gz`;
          
          const fileContent = await fs.readFile(filePath);
          const compressed = zlib.gzipSync(fileContent);
          
          await fs.writeFile(compressedPath, compressed);
          await fs.unlink(filePath);
          
          logger.info(`Compressed log file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Failed to compress logs', error);
    }
  }
  
  async cleanupOldFiles(retentionDays = 30) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const files = await fs.readdir(this.logsPath);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      for (const file of files) {
        const filePath = path.join(this.logsPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          logger.info(`Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old files', error);
    }
  }
}
```

### Performance Monitoring
```javascript
// Monitoramento detalhado de performance
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      messageProcessingTime: [],
      telegramApiTime: [],
      fileWriteTime: [],
      filterProcessingTime: []
    };
    
    this.setupReporting();
  }
  
  async measureAsync(operation, category) {
    const start = process.hrtime.bigint();
    
    try {
      const result = await operation();
      
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to ms
      
      this.recordMetric(category, duration);
      
      return result;
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;
      
      this.recordMetric(`${category}_error`, duration);
      throw error;
    }
  }
  
  recordMetric(category, duration) {
    if (!this.metrics[category]) {
      this.metrics[category] = [];
    }
    
    this.metrics[category].push({
      duration,
      timestamp: Date.now()
    });
    
    // Manter apenas últimas 100 medições
    if (this.metrics[category].length > 100) {
      this.metrics[category].shift();
    }
  }
  
  getStats(category) {
    const measurements = this.metrics[category] || [];
    if (measurements.length === 0) return null;
    
    const durations = measurements.map(m => m.duration);
    durations.sort((a, b) => a - b);
    
    return {
      count: durations.length,
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p95: durations[Math.floor(durations.length * 0.95)]
    };
  }
  
  setupReporting() {
    // Report a cada 10 minutos
    setInterval(() => {
      const report = {};
      
      for (const category of Object.keys(this.metrics)) {
        const stats = this.getStats(category);
        if (stats) {
          report[category] = stats;
        }
      }
      
      if (Object.keys(report).length > 0) {
        logger.info('Performance report', report);
      }
    }, 10 * 60 * 1000);
  }
}
```

## 3. Documentação

### Guia de Instalação (`docs/INSTALLATION.md`)
```markdown
# MilesGuard - Guia de Instalação

## Pré-requisitos

- Node.js 18+ 
- PM2 (para produção)
- Bot do Telegram configurado

## Passo a Passo

### 1. Clonar e Instalar
```bash
git clone https://github.com/user/milesguard.git
cd milesguard
npm install
```

### 2. Configurar Bot Telegram
1. Fale com @BotFather no Telegram
2. Crie um novo bot: `/newbot`
3. Anote o token fornecido
4. Adicione o bot em um chat privado
5. Obtenha seu Chat ID com `/start`

### 3. Configurar Ambiente
```bash
cp .env.example .env
# Editar .env com suas configurações
```

### 4. Executar Wizard de Configuração
```bash
npm run config
# Seguir as instruções na tela
```

### 5. Testar Conexão
```bash
npm start
# Escanear QR Code com WhatsApp
```

### 6. Produção
```bash
npm run prod
# Sistema funcionando 24/7
```

## Solução de Problemas

### QR Code não aparece
- Verificar se WhatsApp Web está fechado
- Limpar sessions: `rm -rf sessions/`

### Bot Telegram não responde
- Verificar TELEGRAM_BOT_TOKEN no .env
- Testar: `npm run test-notification`

### PM2 não inicia
- Instalar globalmente: `npm install -g pm2`
- Verificar permissões de pasta
```

### FAQ (`docs/FAQ.md`)
```markdown
# Perguntas Frequentes

## Posso usar com múltiplas contas WhatsApp?
Não. O WhatsApp permite apenas uma sessão ativa por número.

## Quantos grupos posso monitorar?
Teoricamente ilimitado, mas recomendamos até 10 grupos para melhor performance.

## O sistema funciona se o computador for desligado?
Não. Para operação 24/7, considere usar um Raspberry Pi ou VPS.

## Como fazer backup das configurações?
```bash
tar -czf backup.tar.gz config.json logs/ sessions/
```

## O WhatsApp pode banir minha conta?
O risco é mínimo se usado moderadamente. Evite spam ou automações abusivas.
```

### Exemplos de Configuração (`docs/EXAMPLES.md`)
```markdown
# Exemplos de Configuração

## Para Milhas/Pontos
```json
{
  "comunidade": "Comunidade de Milhas",
  "subgrupos": ["Compra de Pontos", "Transferências", "Promoções"],
  "palavras_chave": ["bônus", "100%", "latam", "smiles", "azul", "transferência"],
  "case_sensitive": false
}
```

## Para Ofertas de Viagem
```json
{
  "subgrupos": ["Passagens Promocionais", "Hotéis", "Pacotes"],
  "palavras_chave": ["promoção", "desconto", "50%", "grátis", "cashback"],
  "rate_limit": 30
}
```

## Para Investimentos
```json
{
  "subgrupos": ["Renda Fixa", "Ações", "FIIs"],
  "palavras_chave": ["cdi", "selic", "dividendo", "yield", "liquidez"],
  "rate_limit": 120
}
```
```

## 4. Interface Melhorada

### Web Dashboard (Opcional)
```javascript
// Simple Express server for web interface
const express = require('express');
const app = express();

class WebDashboard {
  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.setupRoutes();
  }
  
  setupRoutes() {
    this.app.get('/', (req, res) => {
      res.json({
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        stats: this.getStats()
      });
    });
    
    this.app.get('/logs', (req, res) => {
      // Servir logs recentes
    });
    
    this.app.get('/config', (req, res) => {
      // Mostrar configuração atual
    });
  }
  
  start() {
    this.app.listen(this.port, () => {
      logger.info(`Web dashboard available at http://localhost:${this.port}`);
    });
  }
}
```

### Rich Console Output
```javascript
// Console output melhorado com cores e formatação
class RichConsole {
  static logConnection(status) {
    if (status === 'open') {
      console.log(chalk.green.bold('✅ WhatsApp Connected Successfully!'));
      console.log(chalk.cyan('📱 Monitoring active groups...'));
    } else {
      console.log(chalk.red.bold('❌ WhatsApp Disconnected'));
    }
  }
  
  static logMessage(message) {
    const timestamp = new Date().toLocaleTimeString();
    const group = chalk.blue.bold(message.groupName);
    const sender = chalk.yellow(message.senderName);
    const keywords = message.matchedKeywords.map(k => 
      chalk.green(`#${k}`)
    ).join(' ');
    
    console.log(`
┌─ ${chalk.gray(timestamp)} ${chalk.green('MATCH FOUND')}
├─ 📱 Group: ${group}
├─ 👤 From: ${sender}  
├─ 🏷️  Keywords: ${keywords}
└─ 💬 "${message.text.substring(0, 80)}${message.text.length > 80 ? '...' : ''}"
    `);
  }
  
  static logStats(stats) {
    console.log(chalk.cyan.bold('\n📊 Daily Statistics'));
    console.log(`Messages processed: ${chalk.yellow(stats.messagesProcessed)}`);
    console.log(`Notifications sent: ${chalk.green(stats.notificationsSent)}`);
    console.log(`Active groups: ${chalk.blue(stats.activeGroups)}`);
    console.log(`Top keywords: ${stats.topKeywords.join(', ')}\n`);
  }
}
```

## 5. Advanced Features

### Smart Keyword Learning
```javascript
// Sistema que aprende novas palavras-chave baseado em padrões
class KeywordLearning {
  constructor() {
    this.candidateKeywords = new Map();
    this.learningThreshold = 5; // aparições mínimas
  }
  
  analyzeMessage(message, wasManuallyMarkedRelevant) {
    if (wasManuallyMarkedRelevant) {
      const words = this.extractPotentialKeywords(message.text);
      
      words.forEach(word => {
        const count = this.candidateKeywords.get(word) || 0;
        this.candidateKeywords.set(word, count + 1);
        
        if (count + 1 >= this.learningThreshold) {
          this.suggestKeyword(word);
        }
      });
    }
  }
  
  extractPotentialKeywords(text) {
    return text.toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length >= 3 && 
        word.length <= 15 &&
        /^[a-zA-Z0-9%]+$/.test(word)
      );
  }
  
  suggestKeyword(keyword) {
    logger.info(`💡 Keyword suggestion: "${keyword}" appeared ${this.candidateKeywords.get(keyword)} times`);
    // Opcional: enviar sugestão via Telegram
  }
}
```

### Contextual Filtering
```javascript
// Filtros mais inteligentes baseados em contexto
class ContextualFilter {
  constructor() {
    this.timeBasedRules = new Map();
    this.groupContexts = new Map();
  }
  
  shouldProcessMessage(message, groupName) {
    // Filtros baseados em horário
    if (this.isInQuietHours()) {
      return this.isHighPriorityMessage(message);
    }
    
    // Filtros baseados no contexto do grupo
    const context = this.getGroupContext(groupName);
    return this.contextualMatch(message, context);
  }
  
  isHighPriorityMessage(message) {
    const urgentKeywords = ['100%', 'últimas horas', 'hoje apenas', 'limite'];
    return urgentKeywords.some(keyword => 
      message.text.toLowerCase().includes(keyword)
    );
  }
  
  isInQuietHours() {
    const hour = new Date().getHours();
    return hour >= 23 || hour <= 7; // 23:00 às 07:00
  }
}
```

## 6. Outputs da Fase

### Funcionalidades Implementadas
- ✅ Dashboard com status detalhado
- ✅ Resumos diários e semanais automáticos
- ✅ Comandos interativos no Telegram
- ✅ Sistema de toggle de filtros dinâmico
- ✅ Cache inteligente anti-spam
- ✅ Deduplicação avançada de mensagens
- ✅ Compressão e limpeza automática de logs
- ✅ Monitoramento de performance
- ✅ Documentação completa
- ✅ Interface de console melhorada

### Sistema Refinado
Após esta fase, o MilesGuard oferece:
- Experiência de usuário superior
- Performance otimizada 
- Manutenção automatizada
- Documentação completa
- Recursos avançados de monitoramento

## 7. Preparação para Fase 6

O sistema está agora polido e pronto para migração para hardware dedicado (Raspberry Pi), mantendo todas as funcionalidades avançadas desenvolvidas nesta fase.