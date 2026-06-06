const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');

const MessageRepository = require('../../../src/repositories/message.repository');
const { MessageModel } = require('../../../src/models/message.model');
const mockMessages = require('../../fixtures/mock-messages');
const { cleanupUtils } = require('../../helpers/cleanup');

describe('MessageRepository', () => {
  let repository;
  let fsStub;
  const testDataPath = './test_data';

  beforeEach(() => {
    repository = new MessageRepository({ dataPath: testDataPath });
    
    // Stub fs methods
    fsStub = {
      mkdir: sinon.stub(fs, 'mkdir'),
      writeFile: sinon.stub(fs, 'writeFile'),
      readFile: sinon.stub(fs, 'readFile'),
      access: sinon.stub(fs, 'access'),
      readdir: sinon.stub(fs, 'readdir'),
      stat: sinon.stub(fs, 'stat')
    };
  });

  afterEach(async () => {
    sinon.restore();
    await cleanupUtils.cleanupTempData(testDataPath);
  });

  describe('Constructor', () => {
    it('should initialize with default data path', () => {
      const defaultRepo = new MessageRepository();
      expect(defaultRepo.dataPath).to.equal('./data');
    });

    it('should initialize with custom data path', () => {
      const customRepo = new MessageRepository({ dataPath: './custom_data' });
      expect(customRepo.dataPath).to.equal('./custom_data');
    });

    it('should initialize empty message cache', () => {
      expect(repository.messageCache.size).to.equal(0);
    });
  });

  describe('saveMessage()', () => {
    it('should save message to file system', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();

      const result = await repository.saveMessage(message);

      expect(result).to.be.true;
      expect(fsStub.mkdir.calledOnce).to.be.true;
      expect(fsStub.writeFile.calledOnce).to.be.true;
    });

    it('should organize messages by date', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      const messageDate = new Date(message.timestamp);
      const expectedPath = path.join(testDataPath, messageDate.toISOString().split('T')[0]);

      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();

      await repository.saveMessage(message);

      expect(fsStub.mkdir.calledWith(expectedPath, { recursive: true })).to.be.true;
    });

    it('should save message as JSON file', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();

      await repository.saveMessage(message);

      const writeCall = fsStub.writeFile.firstCall;
      const [filePath, content, encoding] = writeCall.args;
      
      expect(filePath).to.include('.json');
      expect(encoding).to.equal('utf8');
      
      const parsedContent = JSON.parse(content);
      expect(parsedContent.id).to.equal(message.id);
      expect(parsedContent.text).to.equal(message.text);
    });

    it('should add message to cache after saving', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();

      await repository.saveMessage(message);

      expect(repository.messageCache.has(message.id)).to.be.true;
      expect(repository.messageCache.get(message.id).equals(message)).to.be.true;
    });

    it('should handle file system errors gracefully', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      fsStub.mkdir.resolves();
      fsStub.writeFile.rejects(new Error('Disk full'));

      try {
        await repository.saveMessage(message);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Disk full');
      }
    });

    it('should validate message before saving', async () => {
      try {
        await repository.saveMessage(null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Message é obrigatório');
      }
    });

    it('should validate MessageModel instance', async () => {
      try {
        await repository.saveMessage({ id: 'fake', text: 'fake' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Message deve ser uma instância de MessageModel');
      }
    });
  });

  describe('getMessage()', () => {
    it('should retrieve message from cache if available', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      repository.messageCache.set(message.id, message);

      const result = await repository.getMessage(message.id);

      expect(result.equals(message)).to.be.true;
      expect(fsStub.readFile.called).to.be.false; // Should not read from file
    });

    it('should retrieve message from file system if not in cache', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      const messageData = JSON.stringify(message.toJSON());
      
      fsStub.access.resolves(); // File exists
      fsStub.readFile.resolves(messageData);

      const result = await repository.getMessage(message.id);

      expect(result.id).to.equal(message.id);
      expect(result.text).to.equal(message.text);
      expect(fsStub.readFile.calledOnce).to.be.true;
    });

    it('should add retrieved message to cache', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      const messageData = JSON.stringify(message.toJSON());
      
      fsStub.access.resolves();
      fsStub.readFile.resolves(messageData);

      await repository.getMessage(message.id);

      expect(repository.messageCache.has(message.id)).to.be.true;
    });

    it('should return null for non-existent message', async () => {
      fsStub.access.rejects(new Error('ENOENT'));

      const result = await repository.getMessage('non_existent_id');

      expect(result).to.be.null;
    });

    it('should handle JSON parsing errors', async () => {
      fsStub.access.resolves();
      fsStub.readFile.resolves('invalid json');

      try {
        await repository.getMessage('test_id');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('JSON');
      }
    });
  });

  describe('getMessagesByDate()', () => {
    it('should retrieve messages for specific date', async () => {
      const date = '2024-01-01';
      const messageFiles = ['msg1.json', 'msg2.json'];
      const message1Data = JSON.stringify(mockMessages.basicRelevantMessage);
      const message2Data = JSON.stringify(mockMessages.smilesMessage);

      fsStub.access.resolves();
      fsStub.readdir.resolves(messageFiles);
      fsStub.readFile
        .onFirstCall().resolves(message1Data)
        .onSecondCall().resolves(message2Data);

      const results = await repository.getMessagesByDate(date);

      expect(results).to.have.length(2);
      expect(results[0]).to.be.instanceOf(MessageModel);
      expect(results[1]).to.be.instanceOf(MessageModel);
    });

    it('should filter out non-JSON files', async () => {
      const date = '2024-01-01';
      const files = ['msg1.json', 'readme.txt', 'msg2.json', 'temp.tmp'];
      const message1Data = JSON.stringify(mockMessages.basicRelevantMessage);
      const message2Data = JSON.stringify(mockMessages.smilesMessage);

      fsStub.access.resolves();
      fsStub.readdir.resolves(files);
      fsStub.readFile
        .onFirstCall().resolves(message1Data)
        .onSecondCall().resolves(message2Data);

      const results = await repository.getMessagesByDate(date);

      expect(results).to.have.length(2);
      expect(fsStub.readFile.callCount).to.equal(2); // Only JSON files read
    });

    it('should return empty array for non-existent date directory', async () => {
      fsStub.access.rejects(new Error('ENOENT'));

      const results = await repository.getMessagesByDate('2024-01-01');

      expect(results).to.be.an('array');
      expect(results).to.have.length(0);
    });

    it('should skip corrupted message files', async () => {
      const date = '2024-01-01';
      const messageFiles = ['good.json', 'corrupted.json'];
      const goodMessageData = JSON.stringify(mockMessages.basicRelevantMessage);

      fsStub.access.resolves();
      fsStub.readdir.resolves(messageFiles);
      fsStub.readFile
        .onFirstCall().resolves(goodMessageData)
        .onSecondCall().resolves('invalid json');

      const results = await repository.getMessagesByDate(date);

      expect(results).to.have.length(1);
      expect(results[0].text).to.equal(mockMessages.basicRelevantMessage.text);
    });
  });

  describe('getMessagesByGroup()', () => {
    it('should retrieve messages filtered by group name', async () => {
      const groupName = 'Passagens SUL';
      const messages = [
        new MessageModel({ ...mockMessages.basicRelevantMessage, groupName }),
        new MessageModel({ ...mockMessages.smilesMessage, groupName: 'Other Group' }),
        new MessageModel({ ...mockMessages.caseSensitiveMessage, groupName })
      ];

      // Mock getMessagesByDate to return all messages
      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.getMessagesByGroup(groupName, '2024-01-01');

      expect(results).to.have.length(2);
      expect(results[0].groupName).to.equal(groupName);
      expect(results[1].groupName).to.equal(groupName);
    });

    it('should be case insensitive by default', async () => {
      const messages = [
        new MessageModel({ ...mockMessages.basicRelevantMessage, groupName: 'Passagens SUL' })
      ];

      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.getMessagesByGroup('passagens sul', '2024-01-01');

      expect(results).to.have.length(1);
    });

    it('should respect case sensitivity when specified', async () => {
      const messages = [
        new MessageModel({ ...mockMessages.basicRelevantMessage, groupName: 'Passagens SUL' })
      ];

      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.getMessagesByGroup('passagens sul', '2024-01-01', { caseSensitive: true });

      expect(results).to.have.length(0);
    });
  });

  describe('getMessagesByKeyword()', () => {
    it('should retrieve messages containing specific keyword', async () => {
      const messages = [
        new MessageModel({ ...mockMessages.basicRelevantMessage, matchedKeywords: ['100%', 'bônus'] }),
        new MessageModel({ ...mockMessages.smilesMessage, matchedKeywords: ['smiles'] }),
        new MessageModel({ ...mockMessages.caseSensitiveMessage, matchedKeywords: ['100%', 'LATAM'] })
      ];

      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.getMessagesByKeyword('100%', '2024-01-01');

      expect(results).to.have.length(2);
      expect(results[0].hasKeyword('100%')).to.be.true;
      expect(results[1].hasKeyword('100%')).to.be.true;
    });

    it('should be case insensitive by default', async () => {
      const messages = [
        new MessageModel({ ...mockMessages.caseSensitiveMessage, matchedKeywords: ['LATAM'] })
      ];

      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.getMessagesByKeyword('latam', '2024-01-01');

      expect(results).to.have.length(1);
    });
  });

  describe('searchMessages()', () => {
    it('should search messages by text content', async () => {
      const messages = [
        new MessageModel({ ...mockMessages.basicRelevantMessage, text: 'Oferta imperdível' }),
        new MessageModel({ ...mockMessages.smilesMessage, text: 'Vendo pontos Smiles' }),
        new MessageModel({ ...mockMessages.caseSensitiveMessage, text: 'BONUS especial' })
      ];

      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.searchMessages('oferta', '2024-01-01');

      expect(results).to.have.length(1);
      expect(results[0].text).to.include('Oferta');
    });

    it('should search across multiple criteria', async () => {
      const messages = [
        new MessageModel({
          ...mockMessages.basicRelevantMessage,
          text: 'Oferta Smiles',
          groupName: 'Passagens SUL',
          matchedKeywords: ['oferta']
        })
      ];

      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.searchMessages('smiles', '2024-01-01', {
        searchInText: true,
        searchInKeywords: true,
        searchInGroup: true
      });

      expect(results).to.have.length(1);
    });

    it('should handle empty search term', async () => {
      const messages = [new MessageModel(mockMessages.basicRelevantMessage)];
      sinon.stub(repository, 'getMessagesByDate').resolves(messages);

      const results = await repository.searchMessages('', '2024-01-01');

      expect(results).to.have.length(1); // Returns all messages
    });
  });

  describe('deleteMessage()', () => {
    it('should delete message from file system', async () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      repository.messageCache.set(message.id, message);

      fsStub.access.resolves();
      const unlinkStub = sinon.stub(fs, 'unlink').resolves();

      const result = await repository.deleteMessage(message.id);

      expect(result).to.be.true;
      expect(unlinkStub.calledOnce).to.be.true;
      expect(repository.messageCache.has(message.id)).to.be.false;

      unlinkStub.restore();
    });

    it('should handle non-existent message gracefully', async () => {
      fsStub.access.rejects(new Error('ENOENT'));

      const result = await repository.deleteMessage('non_existent_id');

      expect(result).to.be.false;
    });
  });

  describe('getStats()', () => {
    it('should return repository statistics', async () => {
      const messages = [
        new MessageModel(mockMessages.basicRelevantMessage),
        new MessageModel(mockMessages.smilesMessage),
        new MessageModel(mockMessages.nonRelevantMessage)
      ];

      messages.forEach(msg => repository.messageCache.set(msg.id, msg));

      const stats = repository.getStats();

      expect(stats).to.have.property('totalMessages');
      expect(stats).to.have.property('relevantMessages');
      expect(stats).to.have.property('cachedMessages');
      expect(stats).to.have.property('relevantRate');
      expect(stats.cachedMessages).to.equal(3);
    });
  });

  describe('clearCache()', () => {
    it('should clear message cache', () => {
      const message = new MessageModel(mockMessages.basicRelevantMessage);
      repository.messageCache.set(message.id, message);

      expect(repository.messageCache.size).to.equal(1);

      repository.clearCache();

      expect(repository.messageCache.size).to.equal(0);
    });
  });

  describe('optimizeCache()', () => {
    it('should remove old messages from cache', () => {
      const oldMessage = new MessageModel({
        ...mockMessages.basicRelevantMessage,
        timestamp: Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      });
      
      const newMessage = new MessageModel({
        ...mockMessages.smilesMessage,
        timestamp: Date.now() - 1 * 60 * 60 * 1000 // 1 hour ago
      });

      repository.messageCache.set(oldMessage.id, oldMessage);
      repository.messageCache.set(newMessage.id, newMessage);

      repository.optimizeCache(24 * 60 * 60 * 1000); // Keep messages from last 24 hours

      expect(repository.messageCache.has(oldMessage.id)).to.be.false;
      expect(repository.messageCache.has(newMessage.id)).to.be.true;
    });
  });

  describe('Bulk operations', () => {
    describe('saveMessages()', () => {
      it('should save multiple messages efficiently', async () => {
        const messages = [
          new MessageModel(mockMessages.basicRelevantMessage),
          new MessageModel(mockMessages.smilesMessage),
          new MessageModel(mockMessages.caseSensitiveMessage)
        ];

        fsStub.mkdir.resolves();
        fsStub.writeFile.resolves();

        const results = await repository.saveMessages(messages);

        expect(results).to.have.length(3);
        expect(results.every(r => r === true)).to.be.true;
        expect(fsStub.writeFile.callCount).to.equal(3);
      });

      it('should handle partial failures in bulk save', async () => {
        const messages = [
          new MessageModel(mockMessages.basicRelevantMessage),
          new MessageModel(mockMessages.smilesMessage)
        ];

        fsStub.mkdir.resolves();
        fsStub.writeFile
          .onFirstCall().resolves()
          .onSecondCall().rejects(new Error('Disk full'));

        const results = await repository.saveMessages(messages);

        expect(results).to.have.length(2);
        expect(results[0]).to.be.true;
        expect(results[1]).to.be.false;
      });
    });

    describe('getMessagesInDateRange()', () => {
      it('should retrieve messages across multiple dates', async () => {
        const startDate = '2024-01-01';
        const endDate = '2024-01-03';

        sinon.stub(repository, 'getMessagesByDate')
          .withArgs('2024-01-01').resolves([new MessageModel(mockMessages.basicRelevantMessage)])
          .withArgs('2024-01-02').resolves([new MessageModel(mockMessages.smilesMessage)])
          .withArgs('2024-01-03').resolves([new MessageModel(mockMessages.caseSensitiveMessage)]);

        const results = await repository.getMessagesInDateRange(startDate, endDate);

        expect(results).to.have.length(3);
      });

      it('should sort results by timestamp', async () => {
        const message1 = new MessageModel({ ...mockMessages.basicRelevantMessage, timestamp: 1000 });
        const message2 = new MessageModel({ ...mockMessages.smilesMessage, timestamp: 3000 });
        const message3 = new MessageModel({ ...mockMessages.caseSensitiveMessage, timestamp: 2000 });

        sinon.stub(repository, 'getMessagesByDate')
          .withArgs('2024-01-01').resolves([message1])
          .withArgs('2024-01-02').resolves([message3])
          .withArgs('2024-01-03').resolves([message2]);

        const results = await repository.getMessagesInDateRange('2024-01-01', '2024-01-03');

        expect(results[0].timestamp).to.equal(1000);
        expect(results[1].timestamp).to.equal(2000);
        expect(results[2].timestamp).to.equal(3000);
      });
    });
  });

  describe('Performance considerations', () => {
    it('should handle large number of messages efficiently', async () => {
      const messages = Array.from({ length: 1000 }, (_, i) => 
        new MessageModel({
          id: `test_${i}`,
          text: `Test message ${i}`,
          groupName: 'Test Group',
          timestamp: Date.now() + i
        })
      );

      fsStub.mkdir.resolves();
      fsStub.writeFile.resolves();

      const startTime = Date.now();
      await repository.saveMessages(messages);
      const endTime = Date.now();

      expect(endTime - startTime).to.be.lessThan(5000); // Should complete in reasonable time
      expect(repository.messageCache.size).to.equal(1000);
    });

    it('should optimize memory usage with large cache', () => {
      // Fill cache with many messages
      for (let i = 0; i < 10000; i++) {
        const message = new MessageModel({
          id: `test_${i}`,
          text: `Test message ${i}`,
          groupName: 'Test Group',
          timestamp: Date.now() - i * 1000
        });
        repository.messageCache.set(message.id, message);
      }

      const initialSize = repository.messageCache.size;
      repository.optimizeCache(60 * 1000); // Keep last minute only
      const finalSize = repository.messageCache.size;

      expect(finalSize).to.be.lessThan(initialSize);
      expect(finalSize).to.be.lessThan(100); // Should remove most old messages
    });
  });
});