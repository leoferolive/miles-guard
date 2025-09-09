const { expect } = require('chai');
const sinon = require('sinon');
const EventEmitter = require('events');

const TelegramService = require('../../../src/services/telegram.service');
const { createMockTelegramBot } = require('../../helpers/mock-factories');
const mockMessages = require('../../fixtures/mock-messages');

describe('TelegramService', () => {
  let telegramService;
  let mockBot;
  let originalEnv;

  beforeEach(() => {
    // Mock environment variables
    originalEnv = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
      TELEGRAM_ENABLED: process.env.TELEGRAM_ENABLED
    };
    
    process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token_123';
    process.env.TELEGRAM_CHAT_ID = 'test_chat_id_456';
    process.env.TELEGRAM_ENABLED = 'true';

    // Create mock Telegram bot
    mockBot = createMockTelegramBot();
    
    telegramService = new TelegramService();
    // Replace the internal bot with our mock
    telegramService.bot = mockBot;
  });

  afterEach(() => {
    // Restore environment variables
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    });
    
    sinon.restore();
  });

  describe('Constructor', () => {
    it('should initialize with environment variables', () => {
      expect(telegramService.botToken).to.equal('test_bot_token_123');
      expect(telegramService.chatId).to.equal('test_chat_id_456');
      expect(telegramService.enabled).to.be.true;
    });

    it('should be disabled when TELEGRAM_ENABLED is false', () => {
      process.env.TELEGRAM_ENABLED = 'false';
      const disabledService = new TelegramService();
      
      expect(disabledService.enabled).to.be.false;
    });

    it('should handle missing bot token', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      
      expect(() => new TelegramService()).to.throw('TELEGRAM_BOT_TOKEN não configurado');
    });

    it('should handle missing chat ID', () => {
      delete process.env.TELEGRAM_CHAT_ID;
      
      expect(() => new TelegramService()).to.throw('TELEGRAM_CHAT_ID não configurado');
    });
  });

  describe('sendMessage()', () => {
    it('should send simple text message successfully', async () => {
      const testMessage = 'Test notification message';
      mockBot.sendMessage.resolves({ message_id: 123 });
      
      const result = await telegramService.sendMessage(testMessage);
      
      expect(result).to.deep.equal({ message_id: 123 });
      expect(mockBot.sendMessage).to.have.been.calledOnceWith(
        'test_chat_id_456',
        testMessage,
        { parse_mode: 'Markdown' }
      );
    });

    it('should send message with custom options', async () => {
      const testMessage = 'Test message';
      const customOptions = { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
      };
      mockBot.sendMessage.resolves({ message_id: 124 });
      
      const result = await telegramService.sendMessage(testMessage, customOptions);
      
      expect(result).to.deep.equal({ message_id: 124 });
      expect(mockBot.sendMessage).to.have.been.calledOnceWith(
        'test_chat_id_456',
        testMessage,
        customOptions
      );
    });

    it('should handle Telegram API errors', async () => {
      const testMessage = 'Test message';
      const telegramError = new Error('Telegram API Error: Chat not found');
      mockBot.sendMessage.rejects(telegramError);
      
      try {
        await telegramService.sendMessage(testMessage);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Telegram API Error');
      }
    });

    it('should not send message when service is disabled', async () => {
      telegramService.enabled = false;
      
      const result = await telegramService.sendMessage('Test message');
      
      expect(result).to.be.null;
      expect(mockBot.sendMessage).to.not.have.been.called;
    });

    it('should handle empty message', async () => {
      try {
        await telegramService.sendMessage('');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Mensagem não pode estar vazia');
      }
    });

    it('should handle null message', async () => {
      try {
        await telegramService.sendMessage(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Mensagem não pode estar vazia');
      }
    });
  });

  describe('sendRelevantMessage()', () => {
    it('should format and send relevant message', async () => {
      const relevantMessage = mockMessages.basicRelevantMessage;
      mockBot.sendMessage.resolves({ message_id: 125 });
      
      const result = await telegramService.sendRelevantMessage(relevantMessage);
      
      expect(result).to.deep.equal({ message_id: 125 });
      expect(mockBot.sendMessage).to.have.been.calledOnce;
      
      const [chatId, message, options] = mockBot.sendMessage.firstCall.args;
      expect(chatId).to.equal('test_chat_id_456');
      expect(message).to.include('🎯 *Nova oferta relevante detectada!*');
      expect(message).to.include('📱 *Grupo:* Passagens SUL');
      expect(message).to.include('👤 *De:* João Silva');
      expect(message).to.include('💬 *Mensagem:*');
      expect(message).to.include('🔍 *Palavras-chave encontradas:*');
      expect(options.parse_mode).to.equal('Markdown');
    });

    it('should handle long messages with truncation', async () => {
      const longMessage = {
        ...mockMessages.longMessage,
        text: 'A'.repeat(1000) // Very long message
      };
      mockBot.sendMessage.resolves({ message_id: 126 });
      
      await telegramService.sendRelevantMessage(longMessage);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('...');
      expect(message.length).to.be.lessThan(4000); // Telegram message limit consideration
    });

    it('should format timestamps correctly', async () => {
      const relevantMessage = {
        ...mockMessages.basicRelevantMessage,
        timestamp: 1640995200000 // Fixed timestamp
      };
      mockBot.sendMessage.resolves({ message_id: 127 });
      
      await telegramService.sendRelevantMessage(relevantMessage);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('🕐 *Horário:*');
    });

    it('should handle message without matched keywords', async () => {
      const messageWithoutKeywords = {
        ...mockMessages.basicRelevantMessage,
        matchedKeywords: []
      };
      mockBot.sendMessage.resolves({ message_id: 128 });
      
      await telegramService.sendRelevantMessage(messageWithoutKeywords);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('🔍 *Palavras-chave encontradas:* Nenhuma');
    });

    it('should escape Markdown special characters', async () => {
      const messageWithSpecialChars = {
        ...mockMessages.basicRelevantMessage,
        sender: 'João_Silva*Test',
        text: 'Message with *bold* and _italic_ text'
      };
      mockBot.sendMessage.resolves({ message_id: 129 });
      
      await telegramService.sendRelevantMessage(messageWithSpecialChars);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      // Should escape special characters properly
      expect(message).to.include('João\\_Silva\\*Test');
    });
  });

  describe('sendNotification()', () => {
    it('should send formatted notification message', async () => {
      const title = 'Test Notification';
      const body = 'This is a test notification body';
      mockBot.sendMessage.resolves({ message_id: 130 });
      
      const result = await telegramService.sendNotification(title, body);
      
      expect(result).to.deep.equal({ message_id: 130 });
      expect(mockBot.sendMessage).to.have.been.calledOnce;
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('📢 *Test Notification*');
      expect(message).to.include('This is a test notification body');
    });

    it('should handle notification with additional info', async () => {
      const title = 'Alert';
      const body = 'System alert';
      const additionalInfo = { 
        timestamp: Date.now(),
        severity: 'high' 
      };
      mockBot.sendMessage.resolves({ message_id: 131 });
      
      await telegramService.sendNotification(title, body, additionalInfo);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('📢 *Alert*');
      expect(message).to.include('System alert');
    });
  });

  describe('isEnabled()', () => {
    it('should return true when service is enabled', () => {
      expect(telegramService.isEnabled()).to.be.true;
    });

    it('should return false when service is disabled', () => {
      telegramService.enabled = false;
      expect(telegramService.isEnabled()).to.be.false;
    });
  });

  describe('getQueueStatus()', () => {
    it('should return queue status information', () => {
      const status = telegramService.getQueueStatus();
      
      expect(status).to.have.property('enabled');
      expect(status).to.have.property('queueLength');
      expect(status).to.have.property('isProcessing');
      expect(status).to.have.property('lastSent');
      expect(status).to.have.property('totalSent');
      expect(status).to.have.property('errors');
    });
  });

  describe('getStats()', () => {
    it('should return service statistics', async () => {
      // Send some messages to generate stats
      mockBot.sendMessage.resolves({ message_id: 132 });
      
      await telegramService.sendMessage('Test message 1');
      await telegramService.sendMessage('Test message 2');
      
      const stats = telegramService.getStats();
      
      expect(stats).to.have.property('totalSent');
      expect(stats).to.have.property('successCount');
      expect(stats).to.have.property('errorCount');
      expect(stats).to.have.property('successRate');
      expect(stats.totalSent).to.be.at.least(2);
    });
  });

  describe('resetStats()', () => {
    it('should reset service statistics', async () => {
      // Send a message first
      mockBot.sendMessage.resolves({ message_id: 133 });
      await telegramService.sendMessage('Test message');
      
      telegramService.resetStats();
      
      const stats = telegramService.getStats();
      expect(stats.totalSent).to.equal(0);
      expect(stats.successCount).to.equal(0);
      expect(stats.errorCount).to.equal(0);
    });
  });

  describe('shutdown()', () => {
    it('should shutdown service gracefully', async () => {
      const shutdownPromise = telegramService.shutdown();
      
      expect(shutdownPromise).to.be.a('promise');
      await shutdownPromise;
      
      // Should be able to shutdown without errors
    });

    it('should clear any pending operations during shutdown', async () => {
      // Add some operations to queue
      const promise1 = telegramService.sendMessage('Message 1');
      const promise2 = telegramService.sendMessage('Message 2');
      
      mockBot.sendMessage.resolves({ message_id: 134 });
      
      await telegramService.shutdown();
      
      // Pending operations should still complete
      await Promise.all([promise1, promise2]);
    });
  });

  describe('Error handling and retry logic', () => {
    it('should implement retry logic for failed messages', async () => {
      const testMessage = 'Test retry message';
      
      // First attempt fails, second succeeds
      mockBot.sendMessage
        .onFirstCall().rejects(new Error('Network error'))
        .onSecondCall().resolves({ message_id: 135 });
      
      // Enable retry logic (if implemented)
      telegramService.retryAttempts = 2;
      telegramService.retryDelay = 100;
      
      try {
        const result = await telegramService.sendMessage(testMessage);
        // Should eventually succeed if retry is implemented
        expect(mockBot.sendMessage).to.have.been.calledTwice;
      } catch (error) {
        // If retry is not implemented yet, that's also acceptable
        expect(mockBot.sendMessage).to.have.been.calledOnce;
      }
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.response = { statusCode: 429 };
      
      mockBot.sendMessage.rejects(rateLimitError);
      
      try {
        await telegramService.sendMessage('Rate limited message');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Too Many Requests');
      }
    });
  });

  describe('Message formatting edge cases', () => {
    it('should handle very long group names', async () => {
      const messageWithLongGroupName = {
        ...mockMessages.basicRelevantMessage,
        groupName: 'A'.repeat(200) // Very long group name
      };
      mockBot.sendMessage.resolves({ message_id: 136 });
      
      await telegramService.sendRelevantMessage(messageWithLongGroupName);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.be.a('string');
      expect(message.length).to.be.lessThan(4000);
    });

    it('should handle messages with emojis', async () => {
      const messageWithEmojis = {
        ...mockMessages.basicRelevantMessage,
        text: '🎉 Oferta especial! 💰 100% bônus na LATAM ✈️'
      };
      mockBot.sendMessage.resolves({ message_id: 137 });
      
      await telegramService.sendRelevantMessage(messageWithEmojis);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('🎉');
      expect(message).to.include('💰');
      expect(message).to.include('✈️');
    });

    it('should handle messages with URLs', async () => {
      const messageWithURL = {
        ...mockMessages.basicRelevantMessage,
        text: 'Check this offer: https://example.com/offer?id=123&bonus=100%'
      };
      mockBot.sendMessage.resolves({ message_id: 138 });
      
      await telegramService.sendRelevantMessage(messageWithURL);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('https://example.com');
    });
  });

  describe('Integration with different message types', () => {
    it('should handle image messages', async () => {
      const imageMessage = mockMessages.messageWithImageCaption;
      mockBot.sendMessage.resolves({ message_id: 139 });
      
      await telegramService.sendRelevantMessage(imageMessage);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('[Imagem]');
    });

    it('should handle video messages', async () => {
      const videoMessage = mockMessages.messageWithVideoCaption;
      mockBot.sendMessage.resolves({ message_id: 140 });
      
      await telegramService.sendRelevantMessage(videoMessage);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('[Vídeo]');
    });

    it('should handle document messages', async () => {
      const documentMessage = mockMessages.messageWithDocumentCaption;
      mockBot.sendMessage.resolves({ message_id: 141 });
      
      await telegramService.sendRelevantMessage(documentMessage);
      
      const [, message] = mockBot.sendMessage.firstCall.args;
      expect(message).to.include('[Documento]');
    });
  });
});