const { expect } = require('chai');
const sinon = require('sinon');

const FilterService = require('../../../src/services/filter.service');
const { createMockConfigService } = require('../../helpers/mock-factories');
const mockMessages = require('../../fixtures/mock-messages');
const mockConfigs = require('../../fixtures/mock-configs');

describe('FilterService', () => {
  let filterService;
  let mockConfigService;

  beforeEach(() => {
    mockConfigService = createMockConfigService(mockConfigs.basicConfig);
    filterService = new FilterService(mockConfigService);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor', () => {
    it('should initialize with config service', () => {
      expect(filterService.configService).to.equal(mockConfigService);
    });

    it('should throw error without config service', () => {
      expect(() => new FilterService()).to.throw('ConfigService é obrigatório');
    });
  });

  describe('shouldProcessMessage()', () => {
    describe('Group filtering', () => {
      it('should return true for target group with matching keywords', () => {
        const message = {
          groupName: 'Passagens SUL', 
          text: 'This is a test message with keyword'
        };
        
        mockConfigService.isTargetGroup.returns(true);
        
        const result = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
        
        expect(result).to.be.true;
        expect(mockConfigService.isTargetGroup.calledWith('Passagens SUL')).to.be.true;
      });

      it('should return false for target group without matching keywords', () => {
        const message = {
          groupName: 'Passagens SUL',
          text: 'Mensagem irrelevante'
        };
        
        mockConfigService.isTargetGroup.returns(true);
        mockConfigService.matchesKeywords.returns(false);
        
        const result = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
        
        expect(result).to.be.false;
      });

      it('should return false for non-target group even with matching keywords', () => {
        const message = {
          groupName: 'Grupo Irrelevante',
          text: 'Oferta com 100% bônus!'
        };
        
        mockConfigService.isTargetGroup.returns(false);
        mockConfigService.matchesKeywords.returns(true);
        
        const result = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
        
        expect(result).to.be.false;
        expect(mockConfigService.matchesKeywords.called).to.be.false;
      });
    });

    describe('Input validation', () => {
      it('should return false for null message', () => {
        const result = filterService.shouldProcessMessage(null, 'Test Group').shouldProcess;
        expect(result).to.be.false;
      });

      it('should return false for undefined message', () => {
        const result = filterService.shouldProcessMessage(undefined, 'Test Group').shouldProcess;
        expect(result).to.be.false;
      });

      it('should return false for message without groupName', () => {
        const message = { text: 'Some text' };
        const result = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
        expect(result).to.be.false;
      });

      it('should return false for message without text', () => {
        const message = { groupName: 'Test Group' };
        const result = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
        expect(result).to.be.false;
      });

      it('should return false for message with empty text', () => {
        const message = { 
          groupName: 'Test Group',
          text: '' 
        };
        
        mockConfigService.isTargetGroup.returns(true);
        
        const result = filterService.shouldProcessMessage(message, message.groupName).shouldProcess;
        
        expect(result).to.be.false;
      });
    });

    describe('Real message scenarios', () => {
      it('should correctly filter basic relevant message', () => {
        mockConfigService.isTargetGroup.returns(true);
        mockConfigService.matchesKeywords.returns(true);
        
        const result = filterService.shouldProcessMessage(mockMessages.basicRelevantMessage, mockMessages.basicRelevantMessage.groupName).shouldProcess;
        
        expect(result).to.be.true;
      });

      it('should correctly filter Smiles message', () => {
        mockConfigService.isTargetGroup.returns(true);
        mockConfigService.matchesKeywords.returns(true);
        
        const result = filterService.shouldProcessMessage(mockMessages.smilesMessage, mockMessages.smilesMessage.groupName).shouldProcess;
        
        expect(result).to.be.true;
      });

      it('should correctly filter non-relevant message', () => {
        mockConfigService.isTargetGroup.returns(true);
        mockConfigService.matchesKeywords.returns(false);
        
        const result = filterService.shouldProcessMessage(mockMessages.nonRelevantMessage, mockMessages.nonRelevantMessage.groupName).shouldProcess;
        
        expect(result).to.be.false;
      });

      it('should handle long messages', () => {
        mockConfigService.isTargetGroup.returns(true);
        mockConfigService.matchesKeywords.returns(true);
        
        const result = filterService.shouldProcessMessage(mockMessages.longMessage, mockMessages.longMessage.groupName).shouldProcess;
        
        expect(result).to.be.true;
      });
    });
  });

  describe('getMatchedKeywords()', () => {
    it('should return matched keywords from config service', () => {
      const text = 'Oferta com 100% bônus na LATAM!';
      const expectedKeywords = ['100%', 'bônus', 'latam'];
      
      mockConfigService.getMatchedKeywords.returns(expectedKeywords);
      
      const result = filterService.getMatchedKeywords(text);
      
      expect(result).to.deep.equal(expectedKeywords);
      expect(mockConfigService.getMatchedKeywords.calledWith(text)).to.be.true;
    });

    it('should return empty array for non-matching text', () => {
      const text = 'Mensagem irrelevante';
      
      mockConfigService.getMatchedKeywords.returns([]);
      
      const result = filterService.getMatchedKeywords(text);
      
      expect(result).to.deep.equal([]);
    });

    it('should handle null text', () => {
      mockConfigService.getMatchedKeywords.returns([]);
      
      const result = filterService.getMatchedKeywords(null);
      
      expect(result).to.deep.equal([]);
    });

    it('should handle empty text', () => {
      mockConfigService.getMatchedKeywords.returns([]);
      
      const result = filterService.getMatchedKeywords('');
      
      expect(result).to.deep.equal([]);
    });
  });

  describe('filterMessages()', () => {
    it('should filter array of messages correctly', () => {
      // Setup mocks to make only some messages relevant
      mockConfigService.isTargetGroup.returns(true);
      mockConfigService.matchesKeywords
        .onFirstCall().returns(true)   // First message relevant
        .onSecondCall().returns(false) // Second message not relevant
        .onThirdCall().returns(true);  // Third message relevant
      
      const messages = [
        { groupName: 'Group 1', text: 'relevant message 1' },
        { groupName: 'Group 2', text: 'irrelevant message' },
        { groupName: 'Group 3', text: 'relevant message 2' }
      ];
      
      const result = filterService.filterMessages(messages);
      
      expect(result).to.have.length(2);
      expect(result[0].text).to.equal('relevant message 1');
      expect(result[1].text).to.equal('relevant message 2');
    });

    it('should return empty array for empty input', () => {
      const result = filterService.filterMessages([]);
      expect(result).to.deep.equal([]);
    });

    it('should handle null input', () => {
      const result = filterService.filterMessages(null);
      expect(result).to.deep.equal([]);
    });

    it('should handle undefined input', () => {
      const result = filterService.filterMessages(undefined);
      expect(result).to.deep.equal([]);
    });

    it('should filter all messages when none are relevant', () => {
      mockConfigService.isTargetGroup.returns(true);
      mockConfigService.matchesKeywords.returns(false);
      
      const messages = [
        { groupName: 'Group 1', text: 'irrelevant message 1' },
        { groupName: 'Group 2', text: 'irrelevant message 2' }
      ];
      
      const result = filterService.filterMessages(messages);
      
      expect(result).to.have.length(0);
    });

    it('should return all messages when all are relevant', () => {
      mockConfigService.isTargetGroup.returns(true);
      mockConfigService.matchesKeywords.returns(true);
      
      const messages = [
        { groupName: 'Group 1', text: 'relevant message 1' },
        { groupName: 'Group 2', text: 'relevant message 2' }
      ];
      
      const result = filterService.filterMessages(messages);
      
      expect(result).to.have.length(2);
    });
  });

  describe('createRelevantMessage()', () => {
    it('should create relevant message object with matched keywords', () => {
      const inputMessage = {
        id: 'test_123',
        groupId: 'group_123@g.us',
        groupName: 'Passagens SUL',
        sender: 'João Silva',
        text: 'Oferta com 100% bônus na LATAM!',
        timestamp: Date.now()
      };
      
      const expectedKeywords = ['100%', 'bônus', 'latam'];
      mockConfigService.getMatchedKeywords.returns(expectedKeywords);
      
      const result = filterService.createRelevantMessage(inputMessage);
      
      expect(result).to.deep.include({
        id: 'test_123',
        groupId: 'group_123@g.us',
        groupName: 'Passagens SUL',
        sender: 'João Silva',
        text: 'Oferta com 100% bônus na LATAM!',
        timestamp: inputMessage.timestamp,
        matchedKeywords: expectedKeywords,
        isRelevant: true
      });
    });

    it('should handle message without optional fields', () => {
      const inputMessage = {
        groupName: 'Test Group',
        text: 'Test message with keywords'
      };
      
      mockConfigService.getMatchedKeywords.returns(['test']);
      
      const result = filterService.createRelevantMessage(inputMessage);
      
      expect(result.groupName).to.equal('Test Group');
      expect(result.text).to.equal('Test message with keywords');
      expect(result.matchedKeywords).to.deep.equal(['test']);
      expect(result.isRelevant).to.be.true;
      expect(result.timestamp).to.be.a('number');
    });

    it('should generate timestamp if not provided', () => {
      const inputMessage = {
        groupName: 'Test Group',
        text: 'Test message'
      };
      
      mockConfigService.getMatchedKeywords.returns([]);
      const beforeTime = Date.now();
      
      const result = filterService.createRelevantMessage(inputMessage);
      
      const afterTime = Date.now();
      expect(result.timestamp).to.be.at.least(beforeTime);
      expect(result.timestamp).to.be.at.most(afterTime);
    });
  });

  describe('getFilterStats()', () => {
    it('should return current filter statistics', () => {
      // Process some messages to generate stats
      mockConfigService.isTargetGroup.returns(true);
      mockConfigService.matchesKeywords
        .onCall(0).returns(true)
        .onCall(1).returns(false)
        .onCall(2).returns(true);
      
      const messages = [
        { groupName: 'Group 1', text: 'relevant 1' },
        { groupName: 'Group 2', text: 'irrelevant' },
        { groupName: 'Group 3', text: 'relevant 2' }
      ];
      
      filterService.filterMessages(messages);
      
      const stats = filterService.getFilterStats();
      
      expect(stats).to.have.property('totalProcessed');
      expect(stats).to.have.property('relevantFound');
      expect(stats).to.have.property('relevantRate');
      expect(stats.totalProcessed).to.be.a('number');
      expect(stats.relevantFound).to.be.a('number');
      expect(stats.relevantRate).to.be.a('number');
    });
  });

  describe('resetStats()', () => {
    it('should reset filter statistics', () => {
      // Process some messages first
      mockConfigService.isTargetGroup.returns(true);
      mockConfigService.matchesKeywords.returns(true);
      
      filterService.filterMessages([
        { groupName: 'Group 1', text: 'message 1' }
      ]);
      
      filterService.resetStats();
      
      const stats = filterService.getFilterStats();
      expect(stats.totalProcessed).to.equal(0);
      expect(stats.relevantFound).to.equal(0);
    });
  });

  describe('Integration tests with different configs', () => {
    it('should work with case sensitive configuration', () => {
      const caseSensitiveConfigService = createMockConfigService(mockConfigs.caseSensitiveConfig);
      const caseSensitiveFilter = new FilterService(caseSensitiveConfigService);
      
      caseSensitiveConfigService.isTargetGroup.returns(true);
      caseSensitiveConfigService.matchesKeywords.returns(true);
      caseSensitiveConfigService.getMatchedKeywords.returns(['BONUS']);
      
      const message = {
        groupName: 'Test Group',
        text: 'BONUS na compra!'
      };
      
      const result = caseSensitiveFilter.shouldProcessMessage(message, message.groupName).shouldProcess;
      
      expect(result).to.be.true;
      expect(caseSensitiveConfigService.isTargetGroup.called).to.be.true;
      expect(caseSensitiveConfigService.matchesKeywords.called).to.be.true;
    });

    it('should work with minimal configuration', () => {
      const minimalConfigService = createMockConfigService(mockConfigs.minimalConfig);
      const minimalFilter = new FilterService(minimalConfigService);
      
      minimalConfigService.isTargetGroup.returns(true);
      minimalConfigService.matchesKeywords.returns(true);
      
      const message = {
        groupName: 'Test Group',
        text: 'test message'
      };
      
      const result = minimalFilter.shouldProcessMessage(message, message.groupName).shouldProcess;
      
      expect(result).to.be.true;
    });
  });

  describe('Performance considerations', () => {
    it('should handle large number of messages efficiently', () => {
      mockConfigService.isTargetGroup.returns(true);
      mockConfigService.matchesKeywords.returns(true);
      
      // Create 1000 test messages
      const messages = Array.from({ length: 1000 }, (_, i) => ({
        groupName: `Group ${i}`,
        text: `Message ${i} with keywords`
      }));
      
      const startTime = Date.now();
      const result = filterService.filterMessages(messages);
      const endTime = Date.now();
      
      expect(result).to.have.length(1000);
      expect(endTime - startTime).to.be.lessThan(1000); // Should complete in less than 1 second
    });

    it('should not call keyword matching for non-target groups', () => {
      mockConfigService.isTargetGroup.returns(false);
      mockConfigService.matchesKeywords.returns(true);
      
      const message = {
        groupName: 'Non-target Group',
        text: 'Message with potential keywords'
      };
      
      filterService.shouldProcessMessage(message, 'Test Group');
      
      expect(mockConfigService.isTargetGroup.called).to.be.true;
      expect(mockConfigService.matchesKeywords).to.not.have.been.called;
    });
  });
});