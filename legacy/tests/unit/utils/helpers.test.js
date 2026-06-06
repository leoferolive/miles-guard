const { expect } = require('chai');
const sinon = require('sinon');

const {
  getMessageText,
  normalizeText,
  isSystemMessage,
  formatTimestamp,
  sanitizeFilename,
  sleep,
  createExponentialBackoff,
  isValidGroupId,
  extractGroupName,
  extractSenderName,
  createMessageFingerprint,
  validateEnvVariables
} = require('../../../src/utils/helpers');

describe('Helpers', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getMessageText()', () => {
    it('should extract text from conversation message', () => {
      const message = {
        message: {
          conversation: 'Hello, world!'
        }
      };
      
      expect(getMessageText(message)).to.equal('Hello, world!');
    });

    it('should extract text from extended text message', () => {
      const message = {
        message: {
          extendedTextMessage: {
            text: 'Extended message text'
          }
        }
      };
      
      expect(getMessageText(message)).to.equal('Extended message text');
    });

    it('should extract caption from image message', () => {
      const message = {
        message: {
          imageMessage: {
            caption: 'Image caption'
          }
        }
      };
      
      expect(getMessageText(message)).to.equal('Image caption');
    });

    it('should extract caption from video message', () => {
      const message = {
        message: {
          videoMessage: {
            caption: 'Video caption'
          }
        }
      };
      
      expect(getMessageText(message)).to.equal('Video caption');
    });

    it('should extract caption from document message', () => {
      const message = {
        message: {
          documentMessage: {
            caption: 'Document caption'
          }
        }
      };
      
      expect(getMessageText(message)).to.equal('Document caption');
    });

    it('should handle quoted messages recursively', () => {
      const message = {
        message: {
          quotedMessage: {
            conversation: 'Quoted text'
          }
        }
      };
      
      expect(getMessageText(message)).to.equal('Quoted text');
    });

    it('should return null for empty or invalid message', () => {
      expect(getMessageText(null)).to.be.null;
      expect(getMessageText({})).to.be.null;
      expect(getMessageText({ message: {} })).to.be.null;
    });
  });

  describe('normalizeText()', () => {
    it('should normalize text to lowercase and remove accents', () => {
      expect(normalizeText('HELLO WORLD')).to.equal('hello world');
      expect(normalizeText('Olá Mundo')).to.equal('ola mundo');
      expect(normalizeText('Café com Açúcar')).to.equal('cafe com acucar');
    });

    it('should handle special characters and trim whitespace', () => {
      expect(normalizeText(' Text with spaces ')).to.equal('text with spaces');
      expect(normalizeText('Ação')).to.equal('acao');
      expect(normalizeText('Coração')).to.equal('coracao');
    });

    it('should return empty string for invalid input', () => {
      expect(normalizeText(null)).to.equal('');
      expect(normalizeText(undefined)).to.equal('');
      expect(normalizeText('')).to.equal('');
      expect(normalizeText(123)).to.equal('');
    });
  });

  describe('isSystemMessage()', () => {
    it('should identify system messages', () => {
      const systemMessage = {
        message: {
          protocolMessage: {}
        }
      };
      
      expect(isSystemMessage(systemMessage)).to.be.true;
    });

    it('should identify sender key distribution messages as system', () => {
      const keyMessage = {
        message: {
          senderKeyDistributionMessage: {}
        }
      };
      
      expect(isSystemMessage(keyMessage)).to.be.true;
    });

    it('should identify context info messages as system', () => {
      const contextMessage = {
        message: {
          messageContextInfo: {}
        }
      };
      
      expect(isSystemMessage(contextMessage)).to.be.true;
    });

    it('should identify messages without text as system', () => {
      const emptyMessage = {
        message: {}
      };
      
      expect(isSystemMessage(emptyMessage)).to.be.true;
    });

    it('should identify regular messages as non-system', () => {
      const regularMessage = {
        message: {
          conversation: 'Regular message'
        }
      };
      
      expect(isSystemMessage(regularMessage)).to.be.false;
    });

    it('should return true for null or undefined messages', () => {
      expect(isSystemMessage(null)).to.be.true;
      expect(isSystemMessage(undefined)).to.be.true;
    });
  });

  describe('formatTimestamp()', () => {
    it('should format timestamp correctly', () => {
      const timestamp = 1640995200; // 2022-01-01 00:00:00 UTC
      const formatted = formatTimestamp(timestamp);
      
      expect(formatted).to.be.an('object');
      expect(formatted.unix).to.equal(timestamp);
      expect(formatted.iso).to.be.a('string');
      expect(formatted.time).to.be.a('string');
      expect(formatted.date).to.be.a('string');
    });

    it('should create consistent format structure', () => {
      const formatted = formatTimestamp(Date.now() / 1000);
      
      expect(formatted).to.have.all.keys(['time', 'date', 'iso', 'unix']);
    });
  });

  describe('sanitizeFilename()', () => {
    it('should remove invalid filename characters', () => {
      expect(sanitizeFilename('file/name')).to.equal('file-name');
      expect(sanitizeFilename('file\\name')).to.equal('file-name');
      expect(sanitizeFilename('file?name')).to.equal('file-name');
      expect(sanitizeFilename('file*name')).to.equal('file-name');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('file name')).to.equal('file_name');
      expect(sanitizeFilename('my file name')).to.equal('my_file_name');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeFilename('MyFile')).to.equal('myfile');
      expect(sanitizeFilename('FILE_NAME')).to.equal('file_name');
    });

    it('should handle complex filenames', () => {
      expect(sanitizeFilename('My/File\\Name?.txt')).to.equal('my-file-name-.txt');
    });
  });

  describe('sleep()', () => {
    it('should return a promise that resolves after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const end = Date.now();
      
      expect(end - start).to.be.at.least(45); // Allow some tolerance
    });

    it('should work with zero delay', async () => {
      await sleep(0);
      // Should not throw and should resolve immediately
    });
  });

  describe('createExponentialBackoff()', () => {
    it('should create backoff function with exponential delay', () => {
      const backoff = createExponentialBackoff(100, 1000, 5);
      
      expect(backoff(0)).to.equal(100);
      expect(backoff(1)).to.equal(200);
      expect(backoff(2)).to.equal(400);
      expect(backoff(3)).to.equal(800);
      expect(backoff(4)).to.equal(1000); // Capped at maxDelay
    });

    it('should return null when max attempts exceeded', () => {
      const backoff = createExponentialBackoff(100, 1000, 3);
      
      expect(backoff(3)).to.be.null;
      expect(backoff(4)).to.be.null;
    });

    it('should respect max delay cap', () => {
      const backoff = createExponentialBackoff(100, 500, 10);
      
      expect(backoff(5)).to.equal(500); // Would be 3200 without cap
      expect(backoff(6)).to.equal(500);
    });
  });

  describe('isValidGroupId()', () => {
    it('should return true for valid group IDs', () => {
      expect(isValidGroupId('123456789@g.us')).to.be.true;
      expect(isValidGroupId('group-123@g.us')).to.be.true;
    });

    it('should return false for invalid group IDs', () => {
      expect(isValidGroupId('123456789@c.us')).to.be.false; // Individual chat
      expect(isValidGroupId('invalid-id')).to.be.false;
      expect(isValidGroupId('')).to.be.false;
      expect(isValidGroupId(null)).to.be.false;
      expect(isValidGroupId(undefined)).to.be.false;
    });
  });

  describe('extractGroupName()', () => {
    it('should extract group name from group object', () => {
      const group = { subject: 'Test Group' };
      expect(extractGroupName(group)).to.equal('Test Group');
    });

    it('should return default name for invalid group', () => {
      expect(extractGroupName(null)).to.equal('Grupo Desconhecido');
      expect(extractGroupName({})).to.equal('Grupo Desconhecido');
      expect(extractGroupName({ name: 'Wrong Property' })).to.equal('Grupo Desconhecido');
    });
  });

  describe('extractSenderName()', () => {
    it('should extract sender name from pushName', () => {
      const message = { pushName: 'John Doe' };
      expect(extractSenderName(message)).to.equal('John Doe');
    });

    it('should extract sender name from key participant', () => {
      const message = {
        key: {
          participant: '123456789@c.us'
        }
      };
      expect(extractSenderName(message)).to.equal('123456789');
    });

    it('should prioritize pushName over key participant', () => {
      const message = {
        pushName: 'John Doe',
        key: {
          participant: '123456789@c.us'
        }
      };
      expect(extractSenderName(message)).to.equal('John Doe');
    });

    it('should return default name for invalid message', () => {
      expect(extractSenderName(null)).to.equal('Desconhecido');
      expect(extractSenderName({})).to.equal('Desconhecido');
    });
  });

  describe('createMessageFingerprint()', () => {
    it('should create fingerprint for valid message', () => {
      const message = {
        message: {
          conversation: 'Test message'
        },
        pushName: 'John',
        messageTimestamp: 1640995200
      };
      
      const fingerprint = createMessageFingerprint(message);
      expect(fingerprint).to.be.a('string');
      expect(fingerprint.length).to.be.at.most(24);
    });

    it('should return null for message without text', () => {
      const message = {
        message: {},
        pushName: 'John',
        messageTimestamp: 1640995200
      };
      
      expect(createMessageFingerprint(message)).to.be.null;
    });

    it('should create different fingerprints for different messages', () => {
      const message1 = {
        message: { conversation: 'Message 1' },
        pushName: 'John',
        messageTimestamp: 1640995200
      };
      
      const message2 = {
        message: { conversation: 'Message 2' },
        pushName: 'John',
        messageTimestamp: 1640995200
      };
      
      const fp1 = createMessageFingerprint(message1);
      const fp2 = createMessageFingerprint(message2);
      
      expect(fp1).to.not.equal(fp2);
    });

    it('should create same fingerprint for similar messages in same minute', () => {
      const message1 = {
        message: { conversation: 'Same message' },
        pushName: 'John',
        messageTimestamp: 1640995200
      };
      
      const message2 = {
        message: { conversation: 'Same message' },
        pushName: 'John',
        messageTimestamp: 1640995230 // 30 seconds later, same minute
      };
      
      const fp1 = createMessageFingerprint(message1);
      const fp2 = createMessageFingerprint(message2);
      
      expect(fp1).to.equal(fp2);
    });
  });

  describe('validateEnvVariables()', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should not throw when all required variables are present', () => {
      process.env.TEST_VAR1 = 'value1';
      process.env.TEST_VAR2 = 'value2';
      
      expect(() => {
        validateEnvVariables(['TEST_VAR1', 'TEST_VAR2']);
      }).to.not.throw();
    });

    it('should throw error when required variables are missing', () => {
      delete process.env.MISSING_VAR;
      
      expect(() => {
        validateEnvVariables(['MISSING_VAR']);
      }).to.throw('Missing required environment variables: MISSING_VAR');
    });

    it('should list all missing variables', () => {
      delete process.env.MISSING_VAR1;
      delete process.env.MISSING_VAR2;
      
      expect(() => {
        validateEnvVariables(['MISSING_VAR1', 'MISSING_VAR2']);
      }).to.throw('Missing required environment variables: MISSING_VAR1, MISSING_VAR2');
    });

    it('should handle empty array', () => {
      expect(() => {
        validateEnvVariables([]);
      }).to.not.throw();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => getMessageText(null)).to.not.throw();
      expect(() => normalizeText(null)).to.not.throw();
      expect(() => isSystemMessage(null)).to.not.throw();
      expect(() => extractGroupName(null)).to.not.throw();
      expect(() => extractSenderName(null)).to.not.throw();
    });

    it('should handle malformed message objects', () => {
      const malformedMessage = {
        message: {
          extendedTextMessage: {} // Missing text property
        }
      };
      
      expect(getMessageText(malformedMessage)).to.be.null;
    });

    it('should handle very long text in fingerprint creation', () => {
      const longText = 'A'.repeat(1000);
      const message = {
        message: { conversation: longText },
        pushName: 'John',
        messageTimestamp: 1640995200
      };
      
      const fingerprint = createMessageFingerprint(message);
      expect(fingerprint).to.be.a('string');
      expect(fingerprint.length).to.be.at.most(24);
    });
  });

  describe('Performance Considerations', () => {
    it('should handle large number of normalizations efficiently', () => {
      const texts = Array.from({ length: 1000 }, (_, i) => `Text ${i} with Açúcar`);
      const start = Date.now();
      
      texts.forEach(text => normalizeText(text));
      
      const duration = Date.now() - start;
      expect(duration).to.be.lessThan(100); // Should complete quickly
    });

    it('should handle concurrent fingerprint creation', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        message: { conversation: `Message ${i}` },
        pushName: 'John',
        messageTimestamp: 1640995200 + i
      }));
      
      const promises = messages.map(message => 
        Promise.resolve(createMessageFingerprint(message))
      );
      
      const fingerprints = await Promise.all(promises);
      expect(fingerprints).to.have.length(100);
      expect(fingerprints.every(fp => fp && fp.length <= 24)).to.be.true;
    });
  });
});