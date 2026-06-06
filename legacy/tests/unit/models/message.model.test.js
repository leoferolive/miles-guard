const { expect } = require('chai');
const sinon = require('sinon');

const { MessageModel, messageSchema, processedMessageSchema, messageSummarySchema } = require('../../../src/models/message.model');
const mockMessages = require('../../fixtures/mock-messages');

describe('MessageModel', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor', () => {
    it('should create message with all required properties', () => {
      const messageData = {
        id: 'test_message_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Passagens SUL',
        sender: 'João Silva',
        text: 'Oferta imperdível! 100% bônus na transferência para LATAM!',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        },
        matchedKeywords: ['100%', 'bônus', 'latam'],
        isRelevant: true
      };
      
      const message = new MessageModel(messageData);

      expect(message.id).to.equal(messageData.id);
      expect(message.groupId).to.equal(messageData.groupId);
      expect(message.groupName).to.equal(messageData.groupName);
      expect(message.sender).to.equal(messageData.sender);
      expect(message.text).to.equal(messageData.text);
      expect(message.timestamp).to.deep.equal(messageData.timestamp);
      expect(message.matchedKeywords).to.deep.equal(messageData.matchedKeywords);
      expect(message.isRelevant).to.equal(messageData.isRelevant);
    });

    it('should create message with default optional values', () => {
      const messageData = {
        id: 'test_minimal_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group',
        sender: 'Test User',
        text: 'Simple message',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        }
      };
      const message = new MessageModel(messageData);

      expect(message.text).to.equal('Simple message');
      expect(message.groupName).to.equal('Test Group');
      expect(message.matchedKeywords).to.be.an('array').that.is.empty;
      expect(message.isRelevant).to.be.false;
    });

    it('should accept provided timestamp object', () => {
      const testTimestamp = {
        unix: 1640995200,
        iso: '2022-01-01T00:00:00.000Z',
        time: '21:00:00',
        date: '31/12/2021'
      };
      const messageData = {
        id: 'timestamp_test_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group',
        sender: 'Test User',
        text: 'Message with timestamp',
        timestamp: testTimestamp
      };
      const message = new MessageModel(messageData);
      
      expect(message.timestamp).to.deep.equal(testTimestamp);
    });

    it('should calculate messageLength correctly', () => {
      const messageData = {
        id: 'length_test_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group',
        sender: 'Test User',
        text: 'This is a test message',
        timestamp: {
          unix: Math.floor(Date.now() / 1000),
          iso: new Date().toISOString(),
          time: new Date().toLocaleTimeString('pt-BR'),
          date: new Date().toLocaleDateString('pt-BR')
        }
      };
      const message = new MessageModel(messageData);

      expect(message.messageLength).to.equal(22); // 'This is a test message'.length
    });
  });

  describe('Validation', () => {
    it('should throw error for missing required fields', () => {
      expect(() => {
        new MessageModel({
          text: 'Test message'
        });
      }).to.throw();
    });

    it('should throw error for empty required strings', () => {
      expect(() => {
        new MessageModel({
          id: '',
          groupId: 'test@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Test message',
          timestamp: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR')
          }
        });
      }).to.throw();
    });

    it('should throw error for invalid timestamp structure', () => {
      expect(() => {
        new MessageModel({
          id: 'test_001',
          groupId: 'test@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Test message',
          timestamp: Date.now() // Invalid - should be object
        });
      }).to.throw();
    });

    it('should throw error for invalid matchedKeywords type', () => {
      expect(() => {
        new MessageModel({
          id: 'test_001',
          groupId: 'test@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Test message',
          timestamp: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR')
          },
          matchedKeywords: 'not an array'
        });
      }).to.throw();
    });

    it('should throw error for invalid isRelevant type', () => {
      expect(() => {
        new MessageModel({
          id: 'test_001',
          groupId: 'test@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Test message',
          timestamp: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR')
          },
          isRelevant: 'not a boolean'
        });
      }).to.throw();
    });
  });

  describe('Methods', () => {
    let testMessage;

    beforeEach(() => {
      testMessage = new MessageModel({
        id: 'test_method_001',
        groupId: 'test_group_001@g.us',
        groupName: 'Test Group',
        sender: 'Test User',
        text: 'This is a test message with keywords like 100% and bônus',
        timestamp: {
          unix: 1640995200,
          iso: '2022-01-01T00:00:00.000Z',
          time: '21:00:00',
          date: '31/12/2021'
        },
        matchedKeywords: ['100%', 'bônus'],
        isRelevant: true
      });
    });

    describe('toJSON()', () => {
      it('should return plain object representation', () => {
        const json = testMessage.toJSON();
        
        expect(json).to.be.an('object');
        expect(json.id).to.equal('test_method_001');
        expect(json.groupName).to.equal('Test Group');
        expect(json.text).to.equal('This is a test message with keywords like 100% and bônus');
        expect(json.matchedKeywords).to.deep.equal(['100%', 'bônus']);
        expect(json.isRelevant).to.be.true;
        expect(json.messageLength).to.be.a('number');
      });
    });

    describe('toStorageFormat()', () => {
      it('should return storage-formatted object', () => {
        const storage = testMessage.toStorageFormat();
        
        expect(storage).to.be.an('object');
        expect(storage.id).to.equal('test_method_001');
        expect(storage.timestamp).to.equal('2022-01-01T00:00:00.000Z');
        expect(storage.sender).to.equal('Test User');
        expect(storage.text).to.equal('This is a test message with keywords like 100% and bônus');
        expect(storage.matchedKeywords).to.deep.equal(['100%', 'bônus']);
        expect(storage.groupId).to.equal('test_group_001@g.us');
        expect(storage.groupName).to.equal('Test Group');
        expect(storage.messageLength).to.be.a('number');
        expect(storage.processed_at).to.be.a('string');
      });
    });

    describe('toNotificationFormat()', () => {
      it('should return notification-formatted object', () => {
        const notification = testMessage.toNotificationFormat();
        
        expect(notification).to.be.an('object');
        expect(notification.id).to.equal('test_method_001');
        expect(notification.groupName).to.equal('Test Group');
        expect(notification.sender).to.equal('Test User');
        expect(notification.text).to.equal('This is a test message with keywords like 100% and bônus');
        expect(notification.matchedKeywords).to.deep.equal(['100%', 'bônus']);
        expect(notification.timestamp).to.deep.equal(testMessage.timestamp);
        expect(notification.messageLength).to.be.a('number');
      });
    });

    describe('getWordCount()', () => {
      it('should return correct word count', () => {
        const wordCount = testMessage.getWordCount();
        expect(wordCount).to.equal(11); // 'This is a test message with keywords like 100% and bônus'
      });
    });

    describe('getCharacterCount()', () => {
      it('should return correct character count', () => {
        const charCount = testMessage.getCharacterCount();
        expect(charCount).to.equal(testMessage.text.length);
      });
    });

    describe('hasKeyword()', () => {
      it('should return true for existing keyword', () => {
        expect(testMessage.hasKeyword('100%')).to.be.true;
        expect(testMessage.hasKeyword('bônus')).to.be.true;
      });

      it('should return false for non-existing keyword', () => {
        expect(testMessage.hasKeyword('smiles')).to.be.false;
      });

      it('should be case insensitive', () => {
        expect(testMessage.hasKeyword('BÔNUS')).to.be.true;
        expect(testMessage.hasKeyword('Bônus')).to.be.true;
      });
    });

    describe('getKeywordPositions()', () => {
      it('should return correct positions for keyword', () => {
        const positions = testMessage.getKeywordPositions('100%');
        expect(positions).to.be.an('array');
        expect(positions.length).to.be.greaterThan(0);
        expect(positions[0]).to.be.a('number');
      });

      it('should return empty array for non-existing keyword', () => {
        const positions = testMessage.getKeywordPositions('nonexistent');
        expect(positions).to.be.an('array').that.is.empty;
      });
    });

    describe('getKeywordContext()', () => {
      it('should return context around keyword', () => {
        const contexts = testMessage.getKeywordContext('100%', 10);
        expect(contexts).to.be.an('array');
        expect(contexts.length).to.be.greaterThan(0);
        expect(contexts[0]).to.be.a('string');
        expect(contexts[0]).to.include('100%');
      });
    });

    describe('comparison methods', () => {
      let otherMessage;

      beforeEach(() => {
        otherMessage = new MessageModel({
          id: 'test_other_001',
          groupId: 'test_group_001@g.us',
          groupName: 'Other Group',
          sender: 'Other User',
          text: 'Other message',
          timestamp: {
            unix: 1640995200,
            iso: '2022-01-01T00:00:00.000Z',
            time: '21:00:00',
            date: '31/12/2021'
          }
        });
      });

      it('should correctly identify same group', () => {
        expect(testMessage.isSameGroup(otherMessage)).to.be.true;
        
        const differentGroupMessage = new MessageModel({
          id: 'test_different_001',
          groupId: 'different_group@g.us',
          groupName: 'Different Group',
          sender: 'Test User',
          text: 'Different message',
          timestamp: {
            unix: 1640995200,
            iso: '2022-01-01T00:00:00.000Z',
            time: '21:00:00',
            date: '31/12/2021'
          }
        });
        
        expect(testMessage.isSameGroup(differentGroupMessage)).to.be.false;
      });

      it('should correctly identify same sender', () => {
        expect(testMessage.isSameSender(otherMessage)).to.be.false;
        
        otherMessage.data.sender = 'Test User';
        expect(testMessage.isSameSender(otherMessage)).to.be.true;
      });

      it('should correctly identify same day', () => {
        expect(testMessage.isFromSameDay(otherMessage)).to.be.true;
        
        const differentDayMessage = new MessageModel({
          id: 'test_different_day_001',
          groupId: 'test_group_001@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Different day message',
          timestamp: {
            unix: 1641081600,
            iso: '2022-01-02T00:00:00.000Z',
            time: '21:00:00',
            date: '01/01/2022'
          }
        });
        
        expect(testMessage.isFromSameDay(differentDayMessage)).to.be.false;
      });
    });

    describe('time-based methods', () => {
      it('should calculate age correctly', () => {
        const age = testMessage.getAge();
        expect(age).to.be.a('number');
        expect(age).to.be.greaterThan(0);
      });

      it('should determine if message is from today', () => {
        const isFromToday = testMessage.isFromToday();
        expect(isFromToday).to.be.a('boolean');
        expect(isFromToday).to.be.false; // Since timestamp is from 2022
      });

      it('should get correct hour', () => {
        const hour = testMessage.getHour();
        expect(hour).to.be.a('number');
        expect(hour).to.be.at.least(0);
        expect(hour).to.be.at.most(23);
      });
    });

    describe('classification methods', () => {
      it('should identify long messages correctly', () => {
        expect(testMessage.isLongMessage(50)).to.be.true;
        expect(testMessage.isLongMessage(100)).to.be.false;
      });

      it('should identify messages with multiple keywords', () => {
        expect(testMessage.hasMultipleKeywords()).to.be.true;
        
        const singleKeywordMessage = new MessageModel({
          id: 'single_kw_001',
          groupId: 'test_group_001@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Message with one keyword',
          timestamp: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR')
          },
          matchedKeywords: ['keyword']
        });
        
        expect(singleKeywordMessage.hasMultipleKeywords()).to.be.false;
      });

      it('should calculate relevance score correctly', () => {
        const score = testMessage.getRelevanceScore();
        expect(score).to.be.a('number');
        expect(score).to.be.greaterThan(0);
      });
    });
  });

  describe('Static Methods', () => {
    describe('validate()', () => {
      it('should validate correct message data', () => {
        const validData = {
          id: 'valid_001',
          groupId: 'test_group_001@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Valid message',
          timestamp: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR')
          }
        };
        
        expect(() => MessageModel.validate(validData)).to.not.throw();
        const validated = MessageModel.validate(validData);
        expect(validated).to.be.an('object');
      });

      it('should throw error for invalid message data', () => {
        const invalidData = {
          id: 'invalid_001',
          text: 'Invalid message'
          // Missing required fields
        };
        
        expect(() => MessageModel.validate(invalidData)).to.throw();
      });
    });

    describe('validateProcessed()', () => {
      it('should validate processed message data', () => {
        const processedData = {
          id: 'processed_001',
          groupId: 'test_group_001@g.us',
          groupName: 'Test Group',
          sender: 'Test User',
          text: 'Processed message',
          timestamp: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
            time: new Date().toLocaleTimeString('pt-BR'),
            date: new Date().toLocaleDateString('pt-BR')
          },
          isRelevant: true,
          matchedKeywords: ['keyword'],
          filterReason: 'Contains keyword',
          processingTime: 150
        };
        
        expect(() => MessageModel.validateProcessed(processedData)).to.not.throw();
      });
    });

    describe('validateSummary()', () => {
      it('should validate message summary data', () => {
        const summaryData = {
          date: '2022-01-01',
          groupName: 'Test Group',
          totalMessages: 10,
          messageIds: ['msg1', 'msg2'],
          keywordStats: [{ keyword: 'test', count: 5 }],
          senderStats: [{ sender: 'User', count: 3 }],
          lastUpdate: new Date().toISOString()
        };
        
        expect(() => MessageModel.validateSummary(summaryData)).to.not.throw();
      });
    });

    describe('fromWhatsAppMessage()', () => {
      it('should create MessageModel from WhatsApp message', () => {
        const whatsappMessage = {
          key: {
            id: 'whatsapp_msg_001',
            remoteJid: 'group@g.us'
          },
          messageTimestamp: Math.floor(Date.now() / 1000),
          pushName: 'WhatsApp User'
        };
        
        const groupName = 'Test Group';
        const messageText = 'WhatsApp message text';
        const matchedKeywords = ['keyword'];
        
        const message = MessageModel.fromWhatsAppMessage(
          whatsappMessage,
          groupName,
          messageText,
          matchedKeywords
        );
        
        expect(message).to.be.instanceOf(MessageModel);
        expect(message.id).to.equal('whatsapp_msg_001');
        expect(message.groupId).to.equal('group@g.us');
        expect(message.groupName).to.equal(groupName);
        expect(message.sender).to.equal('WhatsApp User');
        expect(message.text).to.equal(messageText);
        expect(message.matchedKeywords).to.deep.equal(matchedKeywords);
        expect(message.isRelevant).to.be.true;
      });

      it('should handle message without pushName', () => {
        const whatsappMessage = {
          key: {
            id: 'whatsapp_msg_002',
            remoteJid: 'group@g.us'
          },
          messageTimestamp: Math.floor(Date.now() / 1000)
          // No pushName
        };
        
        const message = MessageModel.fromWhatsAppMessage(
          whatsappMessage,
          'Test Group',
          'Message text',
          []
        );
        
        expect(message.sender).to.equal('Desconhecido');
      });
    });
  });

  describe('Integration with mock data', () => {
    it('should work with fixture data', () => {
      const mockMessage = mockMessages.basicRelevantMessage;
      
      // Create a properly formatted message for the real model
      const messageData = {
        id: mockMessage.id,
        groupId: mockMessage.groupId || 'test@g.us',
        groupName: mockMessage.groupName,
        sender: mockMessage.sender || 'Test User',
        text: mockMessage.text,
        timestamp: typeof mockMessage.timestamp === 'object' 
          ? mockMessage.timestamp 
          : {
              unix: Math.floor(mockMessage.timestamp / 1000),
              iso: new Date(mockMessage.timestamp).toISOString(),
              time: new Date(mockMessage.timestamp).toLocaleTimeString('pt-BR'),
              date: new Date(mockMessage.timestamp).toLocaleDateString('pt-BR')
            },
        matchedKeywords: mockMessage.matchedKeywords || [],
        isRelevant: mockMessage.isRelevant || false
      };
      
      const message = new MessageModel(messageData);
      expect(message.text).to.equal(mockMessage.text);
      expect(message.groupName).to.equal(mockMessage.groupName);
    });
  });
});