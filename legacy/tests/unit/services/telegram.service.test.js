const { expect } = require('chai');
const sinon = require('sinon');
const { Telegraf } = require('telegraf');

const TelegramService = require('../../../src/services/telegram.service');
const { notificationLogger } = require('../../../src/utils/logger');

describe('TelegramService', () => {
  let telegramService;
  let mockBot;
  let originalEnv;
  let loggerStub;

  beforeEach(() => {
    // Mock environment variables
    originalEnv = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
    };
    
    process.env.TELEGRAM_BOT_TOKEN = 'test_bot_token_123';
    process.env.TELEGRAM_CHAT_ID = 'test_chat_id_456';

    // Stub logger
    loggerStub = sinon.stub(notificationLogger);

    // Create Telegram service
    telegramService = new TelegramService();
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
      expect(telegramService.chatId).to.equal('test_chat_id_456');
      expect(telegramService.isEnabled).to.be.false; // Will be false without proper initialization
    });

    it('should be disabled when TELEGRAM_BOT_TOKEN is missing', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      const service = new TelegramService();
      expect(service.isEnabled).to.be.false;
    });

    it('should be disabled when TELEGRAM_CHAT_ID is missing', () => {
      delete process.env.TELEGRAM_CHAT_ID;
      const service = new TelegramService();
      expect(service.isEnabled).to.be.false;
    });
  });

  describe('sendNotification()', () => {
    it('should return failure when service is disabled', async () => {
      telegramService.isEnabled = false;
      
      const result = await telegramService.sendNotification({
        id: 'test123',
        groupName: 'Test Group',
        sender: 'Test Sender',
        text: 'Test message',
        matchedKeywords: ['test']
      });
      
      expect(result).to.deep.equal({ success: false, reason: 'service_disabled' });
    });
  });

  describe('shutdown()', () => {
    it('should shutdown service gracefully', async () => {
      const infoStub = sinon.stub(notificationLogger, 'info');
      telegramService.isProcessingQueue = true;
      
      await telegramService.shutdown();
      
      expect(telegramService.isProcessingQueue).to.be.false;
      expect(infoStub.calledWith('Shutting down Telegram service')).to.be.true;
    });
  });
});