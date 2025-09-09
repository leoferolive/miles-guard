const TelegramBot = require('node-telegram-bot-api');
const { notificationLogger } = require('../utils/logger');
const { sleep } = require('../utils/helpers');
const env = require('../config/environment');

class TelegramService {
  constructor() {
    this.bot = null;
    this.isEnabled = false;
    this.chatId = env.TELEGRAM_CHAT_ID;
    this.rateLimit = env.TELEGRAM_RATE_LIMIT; // messages per minute
    this.messageQueue = [];
    this.lastMessageTime = 0;
    this.messageInterval = (60 / this.rateLimit) * 1000; // ms between messages
    this.isProcessingQueue = false;

    this.initialize();
  }

  async initialize() {
    if (!env.TELEGRAM_BOT_TOKEN) {
      notificationLogger.warn('Telegram bot token not provided, service disabled');
      return;
    }

    if (!this.chatId) {
      notificationLogger.warn('Telegram chat ID not provided, service disabled');
      return;
    }

    try {
      this.bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });
      
      // Test connection
      const me = await this.bot.getMe();
      notificationLogger.info('Telegram service initialized successfully', { 
        botName: me.username,
        chatId: this.chatId
      });
      
      this.isEnabled = true;
      this.startQueueProcessor();
      
    } catch (error) {
      notificationLogger.logError('telegram_init', error);
      this.isEnabled = false;
    }
  }

  async sendNotification(relevantMessage, options = {}) {
    if (!this.isEnabled) {
      notificationLogger.warn('Telegram service not enabled, skipping notification');
      return { success: false, reason: 'service_disabled' };
    }

    try {
      const formattedMessage = this.formatMessage(relevantMessage, options);
      
      // Add to queue for rate limiting
      return await this.queueMessage(formattedMessage, options);
      
    } catch (error) {
      notificationLogger.logError('notification_send', error, { 
        messageId: relevantMessage.id 
      });
      return { success: false, error: error.message };
    }
  }

  formatMessage(relevantMessage, options = {}) {
    const template = options.template || 'individual';
    
    switch (template) {
    case 'individual':
      return this.formatIndividualMessage(relevantMessage);
    case 'summary':
      return this.formatSummaryMessage(relevantMessage);
    default:
      return this.formatIndividualMessage(relevantMessage);
    }
  }

  formatIndividualMessage(message) {
    const timestamp = message.timestamp?.time || new Date().toLocaleTimeString('pt-BR');
    const keywords = message.matchedKeywords || [];
    const keywordTags = keywords.map(k => `#${k.replace(/\s+/g, '_')}`).join(' ');
    
    let text = '🎯 *Oferta Detectada*\n\n';
    text += `📱 *Grupo:* ${message.groupName}\n`;
    text += `👤 *De:* ${message.sender}\n`;
    text += `🕐 *Hora:* ${timestamp}\n`;
    
    if (keywords.length > 0) {
      text += `🔍 *Palavras-chave:* ${keywordTags}\n`;
    }
    
    text += '\n💬 *Mensagem:*\n';
    text += `\`\`\`\n${message.text.substring(0, 1000)}${message.text.length > 1000 ? '\n...' : ''}\n\`\`\``;
    
    if (message.text.length > 1000) {
      text += `\n📏 *Mensagem truncada* (${message.text.length} caracteres total)`;
    }

    return text;
  }

  formatSummaryMessage(data) {
    let text = '📊 *Resumo de Ofertas*\n\n';
    
    if (data.period) {
      text += `📅 *Período:* ${data.period}\n`;
    }
    
    if (data.totalMessages) {
      text += `📈 *Total de mensagens:* ${data.totalMessages}\n`;
    }
    
    if (data.topGroups && data.topGroups.length > 0) {
      text += '\n🏆 *Grupos mais ativos:*\n';
      data.topGroups.forEach((group, index) => {
        text += `${index + 1}. ${group.name}: ${group.count} mensagens\n`;
      });
    }
    
    if (data.topKeywords && data.topKeywords.length > 0) {
      text += '\n🔍 *Palavras-chave mais encontradas:*\n';
      data.topKeywords.forEach((keyword, index) => {
        text += `${index + 1}. #${keyword.word}: ${keyword.count}x\n`;
      });
    }

    return text;
  }

  async queueMessage(message, options = {}) {
    return new Promise((resolve) => {
      this.messageQueue.push({
        text: message,
        options,
        resolve,
        timestamp: Date.now()
      });
      
      notificationLogger.queue('added', this.messageQueue.length);
    });
  }

  startQueueProcessor() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    this.processQueue();
  }

  async processQueue() {
    while (this.isProcessingQueue) {
      if (this.messageQueue.length === 0) {
        await sleep(1000); // Check queue every second
        continue;
      }

      const now = Date.now();
      const timeSinceLastMessage = now - this.lastMessageTime;

      if (timeSinceLastMessage < this.messageInterval) {
        const waitTime = this.messageInterval - timeSinceLastMessage;
        await sleep(waitTime);
        continue;
      }

      const queueItem = this.messageQueue.shift();
      
      try {
        const result = await this.sendImmediateMessage(queueItem.text, queueItem.options);
        this.lastMessageTime = Date.now();
        
        notificationLogger.sent('telegram', this.chatId, result.success);
        notificationLogger.queue('processed', this.messageQueue.length);
        
        queueItem.resolve(result);
        
      } catch (error) {
        notificationLogger.logError('queue_process', error);
        queueItem.resolve({ success: false, error: error.message });
      }
    }
  }

  async sendImmediateMessage(text, options = {}) {
    try {
      const sendOptions = {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...options
      };

      await this.bot.sendMessage(this.chatId, text, sendOptions);
      
      return { success: true };
      
    } catch (error) {
      notificationLogger.logError('immediate_send', error);
      return { success: false, error: error.message };
    }
  }

  // Admin commands
  async sendStatusMessage(status) {
    if (!this.isEnabled) return { success: false, reason: 'service_disabled' };
    
    const message = this.formatStatusMessage(status);
    return await this.queueMessage(message);
  }

  formatStatusMessage(status) {
    let text = '🤖 *MilesGuard Status*\n\n';
    text += `🟢 *Status:* ${status.isConnected ? 'Conectado' : 'Desconectado'}\n`;
    text += `⏱️ *Uptime:* ${status.uptime || 'N/A'}\n`;
    text += `📊 *Grupos monitorados:* ${status.targetGroupsCount || 0}\n`;
    text += `💬 *Mensagens processadas:* ${status.messagesProcessed || 0}\n`;
    text += `🎯 *Mensagens relevantes:* ${status.messagesMatched || 0}\n`;
    
    if (status.lastMessage) {
      text += `📨 *Última mensagem:* ${status.lastMessage}\n`;
    }

    return text;
  }

  // Utility methods
  async testConnection() {
    if (!this.isEnabled) {
      return { success: false, reason: 'service_disabled' };
    }

    try {
      const testMessage = `🧪 Teste de conexão MilesGuard\n⏰ ${new Date().toLocaleString('pt-BR')}`;
      const result = await this.sendImmediateMessage(testMessage);
      
      notificationLogger.info('Connection test completed', { success: result.success });
      return result;
      
    } catch (error) {
      notificationLogger.logError('connection_test', error);
      return { success: false, error: error.message };
    }
  }

  getQueueStatus() {
    return {
      enabled: this.isEnabled,
      queueLength: this.messageQueue.length,
      rateLimit: this.rateLimit,
      messageInterval: this.messageInterval,
      lastMessageTime: this.lastMessageTime,
      isProcessing: this.isProcessingQueue
    };
  }

  async clearQueue() {
    const clearedCount = this.messageQueue.length;
    this.messageQueue.forEach(item => {
      item.resolve({ success: false, reason: 'queue_cleared' });
    });
    this.messageQueue = [];
    
    notificationLogger.info('Message queue cleared', { clearedCount });
    return clearedCount;
  }

  async shutdown() {
    notificationLogger.info('Shutting down Telegram service');
    this.isProcessingQueue = false;
    
    // Clear remaining queue
    await this.clearQueue();
    
    if (this.bot) {
      await this.bot.stopPolling();
    }
  }
}

module.exports = TelegramService;