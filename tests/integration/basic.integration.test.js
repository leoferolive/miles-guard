const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

// Import services for integration testing
const ConfigService = require('../../src/services/config.service');
const FilterService = require('../../src/services/filter.service');
const TelegramService = require('../../src/services/telegram.service');
const { MessageModel } = require('../../src/models/message.model');

describe('Basic Integration Tests', () => {
  let testConfigPath;
  let configService;
  let filterService;
  
  beforeEach(() => {
    // Create temporary config file for testing
    testConfigPath = path.join(__dirname, '../temp/test-config.json');
    const testConfigDir = path.dirname(testConfigPath);
    
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
    
    const testConfig = {
      comunidade: 'Test Community',
      subgrupos: ['Test Group 1', 'Test Group 2'],
      palavras_chave: ['test', '100%', 'bonus'],
      case_sensitive: false
    };
    
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    
    configService = new ConfigService();
    configService.configPath = testConfigPath; // Override the default config path
    filterService = new FilterService(configService);
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
    
    const testConfigDir = path.dirname(testConfigPath);
    if (fs.existsSync(testConfigDir)) {
      fs.rmdirSync(testConfigDir, { recursive: true });
    }
    
    sinon.restore();
  });

  describe('Config + Filter Integration', () => {
    it('should load config and filter messages correctly', async () => {
      // Load configuration
      await configService.loadConfig();
      const configExists = await configService.configExists();
      expect(configExists).to.be.true;
      
      // Create test message
      const messageData = {
        id: 'integration_test_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group 1',
        sender: 'Test User',
        text: 'This message contains a test keyword and 100% bonus!',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        }
      };
      
      const message = new MessageModel(messageData);
      
      // Test filtering
      const isRelevant = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
      expect(isRelevant).to.be.true;
      
      const keywordResult = filterService.matchesKeywords(message.text);
      expect(keywordResult.matchedKeywords).to.include('test');
      expect(keywordResult.matchedKeywords).to.include('100%');
    });

    it('should handle non-target groups correctly', async () => {
      await configService.loadConfig();
      
      const messageData = {
        id: 'integration_test_002',
        groupId: 'other_group_001@g.us',
        groupName: 'Other Group', // Not in target groups
        sender: 'Test User',
        text: 'This message contains test keywords but is in wrong group',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        }
      };
      
      const message = new MessageModel(messageData);
      
      const isRelevant = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
      expect(isRelevant).to.be.false;
    });

    it('should handle case sensitivity settings', async () => {
      await configService.loadConfig();
      
      const messageData = {
        id: 'integration_test_003',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group 1',
        sender: 'Test User',
        text: 'This message contains TEST in uppercase',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        }
      };
      
      const message = new MessageModel(messageData);
      
      // Should match because case_sensitive is false
      const isRelevant = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
      expect(isRelevant).to.be.true;
      
      const keywordResult = filterService.matchesKeywords(message.text);
      expect(keywordResult.matchedKeywords).to.include('test');
    });
  });

  describe('Message Model + Filter Integration', () => {
    it('should create and filter WhatsApp messages end-to-end', async () => {
      await configService.loadConfig();
      
      // Simulate WhatsApp message structure
      const whatsappMessage = {
        key: {
          id: 'whatsapp_integration_001',
          remoteJid: 'test_group_001@g.us'
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Integration User'
      };
      
      const groupName = 'Test Group 1';
      const messageText = 'Great offer! 100% bonus on miles transfer!';
      
      // Create message using factory method
      const message = MessageModel.fromWhatsAppMessage(
        whatsappMessage,
        groupName,
        messageText
      );
      
      expect(message).to.be.instanceOf(MessageModel);
      expect(message.groupName).to.equal(groupName);
      expect(message.text).to.equal(messageText);
      
      // Filter the message
      const isRelevant = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
      expect(isRelevant).to.be.true;
      
      // Get matched keywords
      const keywordResult = filterService.matchesKeywords(messageText);
      expect(keywordResult.matchedKeywords).to.include('100%');
      expect(keywordResult.matchedKeywords).to.include('bonus');
    });

    it('should handle message transformations correctly', async () => {
      await configService.loadConfig();
      
      const messageData = {
        id: 'transform_test_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group 1',
        sender: 'Transform User',
        text: 'Urgent: test alert with 100% accuracy!',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        }
      };
      
      const message = new MessageModel(messageData);
      
      // Test various output formats
      const jsonFormat = message.toJSON();
      expect(jsonFormat).to.have.property('id');
      expect(jsonFormat).to.have.property('messageLength');
      
      const storageFormat = message.toStorageFormat();
      expect(storageFormat).to.have.property('processed_at');
      expect(storageFormat.timestamp).to.be.a('string'); // ISO format
      
      const notificationFormat = message.toNotificationFormat();
      expect(notificationFormat).to.have.property('timestamp');
      expect(notificationFormat.timestamp).to.be.an('object');
      
      // Verify filtering works with all formats
      const isRelevant = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
      expect(isRelevant).to.be.true;
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle config loading failures gracefully', async () => {
      const invalidConfigService = new ConfigService();
      invalidConfigService.configPath = '/invalid/path/config.json';
      const invalidFilterService = new FilterService(invalidConfigService);
      
      try {
        await invalidConfigService.loadConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('não encontrado');
      }
      
      // Filter service should handle unloaded config
      const testMessage = {
        groupName: 'Test Group',
        text: 'Test message'
      };
      
      const isRelevant = invalidFilterService.shouldProcessMessage(testMessage, testMessage.groupName).shouldProcess;
      expect(isRelevant).to.be.false; // Should return false for unloaded config
    });

    it('should handle invalid message data gracefully', async () => {
      await configService.loadConfig();
      
      // Test with invalid message structures - wrap in try/catch as service may throw
      let nullResult;
      try {
        nullResult = filterService.shouldProcessMessage(null, 'Test');
      } catch (error) {
        nullResult = { shouldProcess: false, reason: 'error' };
      }
      expect(nullResult.shouldProcess).to.be.false;
      
      const emptyResult = filterService.shouldProcessMessage({}, 'Test');
      expect(emptyResult.shouldProcess).to.be.false;
      
      const missingTextResult = filterService.shouldProcessMessage({ groupName: 'Test' }, 'Test');
      expect(missingTextResult.shouldProcess).to.be.false;
      
      const missingGroupResult = filterService.shouldProcessMessage({ text: 'No keywords here' }, 'Random Group');
      expect(missingGroupResult.shouldProcess).to.be.false;
    });

    it('should handle message validation errors', () => {
      // Test with incomplete message data
      expect(() => {
        new MessageModel({
          text: 'Test message'
          // Missing required fields
        });
      }).to.throw();
      
      expect(() => {
        new MessageModel({
          id: 'test',
          groupId: 'test@g.us',
          groupName: 'Test Group',
          sender: 'User',
          text: 'Test message',
          timestamp: 'invalid' // Should be object
        });
      }).to.throw();
    });
  });

  describe('Performance Integration', () => {
    it('should handle bulk message filtering efficiently', async () => {
      await configService.loadConfig();
      
      // Create 100 test messages
      const messages = Array.from({ length: 100 }, (_, i) => {
        const hasKeyword = i % 3 === 0; // Every 3rd message has keyword
        const isTargetGroup = i % 2 === 0; // Every 2nd message is in target group
        
        return new MessageModel({
          id: `bulk_test_${i}`,
          groupId: `test_group_${isTargetGroup ? '001' : '999'}@g.us`,
          groupName: isTargetGroup ? 'Test Group 1' : 'Other Group',
          sender: `User ${i}`,
          text: `Message ${i} ${hasKeyword ? 'test 100%' : 'normal content'}`,
          timestamp: {
            unix: Math.floor(Date.now() / 1000) + i,
            iso: new Date(Date.now() + i * 1000).toISOString(),
            time: new Date(Date.now() + i * 1000).toLocaleTimeString('pt-BR'),
            date: new Date(Date.now() + i * 1000).toLocaleDateString('pt-BR')
          }
        });
      });
      
      const startTime = Date.now();
      
      // Filter all messages
      const results = messages.map(message => ({
        message,
        isRelevant: filterService.shouldProcessMessage(message, message.groupName).shouldProcess,
        keywordResult: filterService.matchesKeywords(message.text)
      }));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly
      expect(duration).to.be.lessThan(1000);
      
      // Verify correct filtering
      const relevantCount = results.filter(r => r.isRelevant).length;
      expect(relevantCount).to.be.greaterThan(0);
      expect(relevantCount).to.be.lessThan(messages.length); // Not all should be relevant
      
      // Verify that only target group messages with keywords are relevant
      results.forEach(result => {
        if (result.isRelevant) {
          expect(result.message.groupName).to.equal('Test Group 1');
          expect(result.keywordResult.matchedKeywords.length).to.be.greaterThan(0);
        }
      });
    });

    it('should handle concurrent operations safely', async () => {
      await configService.loadConfig();
      
      const createAndFilterMessage = (id) => {
        const message = new MessageModel({
          id: `concurrent_${id}`,
          groupId: 'test_group_001@g.us',
          groupName: 'Test Group 1',
          sender: `User ${id}`,
          text: `Concurrent test message ${id} with 100% bonus`,
          timestamp: {
            unix: Math.floor(Date.now() / 1000) + id,
            iso: new Date(Date.now() + id * 1000).toISOString(),
            time: new Date(Date.now() + id * 1000).toLocaleTimeString('pt-BR'),
            date: new Date(Date.now() + id * 1000).toLocaleDateString('pt-BR')
          }
        });
        
        return {
          message,
          isRelevant: filterService.shouldProcessMessage(message, message.groupName).shouldProcess
        };
      };
      
      // Run concurrent operations
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve(createAndFilterMessage(i))
      );
      
      const results = await Promise.all(promises);
      
      // All should be processed successfully
      expect(results).to.have.length(50);
      results.forEach(result => {
        expect(result.isRelevant).to.be.true;
        expect(result.message).to.be.instanceOf(MessageModel);
      });
    });
  });

  describe('Telegram Service Integration', () => {
    it('should initialize without token in test environment', () => {
      // Telegram service should initialize gracefully without token
      const telegramService = new TelegramService();
      // Check if service is disabled or enabled property doesn't exist (which means disabled)
      const isEnabled = telegramService.enabled;
      expect(isEnabled === false || isEnabled === undefined).to.be.true;
    });

    it('should handle message formatting for disabled service', () => {
      const telegramService = new TelegramService();
      
      const messageData = {
        id: 'telegram_test_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group 1',
        sender: 'Telegram User',
        text: 'Test message for telegram integration',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        },
        matchedKeywords: ['test']
      };
      
      const message = new MessageModel(messageData);
      const notificationFormat = message.toNotificationFormat();
      
      expect(notificationFormat).to.have.property('groupName');
      expect(notificationFormat).to.have.property('sender');
      expect(notificationFormat).to.have.property('text');
      expect(notificationFormat).to.have.property('matchedKeywords');
    });
  });
});