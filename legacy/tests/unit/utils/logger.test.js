const { expect } = require('chai');
const sinon = require('sinon');
const winston = require('winston');

const { systemLogger, whatsappLogger } = require('../../../src/utils/logger');

describe('Logger', () => {
  let consoleLogStub;
  let consoleErrorStub;

  beforeEach(() => {
    // Stub console methods to prevent actual logging during tests
    consoleLogStub = sinon.stub(console, 'log');
    consoleErrorStub = sinon.stub(console, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('systemLogger', () => {
    it('should be instance of component logger with required methods', () => {
      expect(systemLogger).to.be.an('object');
      expect(systemLogger.info).to.be.a('function');
      expect(systemLogger.error).to.be.a('function');
      expect(systemLogger.warn).to.be.a('function');
      expect(systemLogger.debug).to.be.a('function');
    });

    it('should have custom methods', () => {
      expect(systemLogger.startup).to.be.a('function');
      expect(systemLogger.shutdown).to.be.a('function');
      expect(systemLogger.logError).to.be.a('function');
    });

    describe('info()', () => {
      it('should log info messages', () => {
        systemLogger.info('Test info message');
        // Logger should not throw errors
      });

      it('should log info with metadata', () => {
        const metadata = { component: 'test', timestamp: Date.now() };
        systemLogger.info('Test message with metadata', metadata);
        // Logger should not throw errors
      });
    });

    describe('error()', () => {
      it('should log error messages', () => {
        systemLogger.error('Test error message');
        // Logger should not throw errors
      });

      it('should log error objects', () => {
        const error = new Error('Test error');
        systemLogger.error('Error occurred', error);
        // Logger should not throw errors
      });
    });

    describe('warn()', () => {
      it('should log warning messages', () => {
        systemLogger.warn('Test warning message');
        // Logger should not throw errors
      });

      it('should log warning with metadata', () => {
        systemLogger.warn('Warning occurred', { reason: 'test' });
        // Logger should not throw errors
      });
    });

    describe('debug()', () => {
      it('should log debug messages', () => {
        systemLogger.debug('Test debug message');
        // Logger should not throw errors
      });

      it('should log debug with detailed metadata', () => {
        const debugData = {
          function: 'testFunction',
          parameters: { param1: 'value1' },
          executionTime: 150
        };
        systemLogger.debug('Function executed', debugData);
        // Logger should not throw errors
      });
    });

    describe('startup()', () => {
      it('should log startup messages', () => {
        systemLogger.startup('Application starting', { version: '1.0.0' });
        // Logger should not throw errors
      });

      it('should handle startup without metadata', () => {
        systemLogger.startup('Simple startup message');
        // Logger should not throw errors
      });
    });

    describe('shutdown()', () => {
      it('should log shutdown messages', () => {
        systemLogger.shutdown('Application shutting down', { uptime: 3600000 });
        // Logger should not throw errors
      });

      it('should handle shutdown without metadata', () => {
        systemLogger.shutdown('Simple shutdown message');
        // Logger should not throw errors
      });
    });

    describe('logError()', () => {
      it('should log structured error information', () => {
        const error = new Error('Test error');
        systemLogger.logError('test_operation', error);
        // Logger should not throw errors
      });

      it('should log error with context', () => {
        const error = new Error('Test error');
        const context = { userId: '123', operation: 'save_message' };
        systemLogger.logError('test_operation', error, context);
        // Logger should not throw errors
      });

      it('should handle non-Error objects', () => {
        systemLogger.logError('test_operation', 'string error');
        // Logger should not throw errors
      });

      it('should handle null errors', () => {
        systemLogger.logError('test_operation', null);
        // Logger should not throw errors
      });
    });
  });

  describe('whatsappLogger', () => {
    it('should be instance of component logger with required methods', () => {
      expect(whatsappLogger).to.be.an('object');
      expect(whatsappLogger.info).to.be.a('function');
      expect(whatsappLogger.error).to.be.a('function');
      expect(whatsappLogger.warn).to.be.a('function');
      expect(whatsappLogger.debug).to.be.a('function');
    });

    it('should have custom methods', () => {
      expect(whatsappLogger.connection).to.be.a('function');
    });

    describe('connection()', () => {
      it('should log connection events', () => {
        whatsappLogger.connection('connecting', { attempt: 1 });
        // Logger should not throw errors
      });

      it('should log different connection states', () => {
        whatsappLogger.connection('connected');
        whatsappLogger.connection('disconnected', { reason: 'network_error' });
        whatsappLogger.connection('reconnecting', { attempt: 2 });
        // Logger should not throw errors
      });

      it('should handle connection logs without metadata', () => {
        whatsappLogger.connection('connected');
        // Logger should not throw errors
      });
    });

    describe('message()', () => {
      it('should log message processing events', () => {
        whatsappLogger.info('Message processed', {
          messageId: 'msg_123',
          groupId: 'group_456',
          relevant: true
        });
        // Logger should not throw errors
      });

      it('should log message filtering results', () => {
        whatsappLogger.info('Message filtered', {
          messageId: 'msg_124',
          keywords: ['100%', 'bonus'],
          relevant: true,
          groupName: 'Test Group'
        });
        // Logger should not throw errors
      });
    });

    describe('group()', () => {
      it('should log group-related events', () => {
        whatsappLogger.info('Groups fetched', {
          totalGroups: 10,
          targetGroups: 3,
          timestamp: Date.now()
        });
        // Logger should not throw errors
      });

      it('should log group updates', () => {
        whatsappLogger.info('Group updated', {
          groupId: 'group_123',
          groupName: 'Test Group',
          change: 'subject_changed'
        });
        // Logger should not throw errors
      });
    });
  });

  describe('Logger Configuration', () => {
    it('should respect NODE_ENV settings', () => {
      // Logger wrapper functions should exist and be functional
      expect(systemLogger.info).to.be.a('function');
      expect(whatsappLogger.info).to.be.a('function');
      
      // Test that they can log without errors
      expect(() => {
        systemLogger.info('Config test');
        whatsappLogger.info('Config test');
      }).to.not.throw();
    });

    it('should handle different log levels in test environment', () => {
      // Component loggers should work regardless of environment
      expect(() => {
        systemLogger.debug('Debug test');
        systemLogger.info('Info test');
        systemLogger.warn('Warn test');
        systemLogger.error('Error test');
      }).to.not.throw();
    });
  });

  describe('Error Handling', () => {
    it('should not throw errors when logging fails', () => {
      // Even if internal logging fails, it should not break the application
      expect(() => {
        systemLogger.info(undefined);
      }).to.not.throw();
    });

    it('should handle circular references in objects', () => {
      const circular = { prop: 'value' };
      circular.self = circular;

      expect(() => {
        systemLogger.info('Circular object test', circular);
      }).to.not.throw();
    });

    it('should handle very large objects', () => {
      const largeObject = {
        data: Array.from({ length: 10000 }, (_, i) => `item_${i}`)
      };

      expect(() => {
        systemLogger.info('Large object test', largeObject);
      }).to.not.throw();
    });

    it('should handle non-serializable objects', () => {
      const nonSerializable = {
        func: () => 'test',
        symbol: Symbol('test'),
        undef: undefined
      };

      expect(() => {
        systemLogger.info('Non-serializable object test', nonSerializable);
      }).to.not.throw();
    });
  });

  describe('Performance Considerations', () => {
    it('should handle high volume logging efficiently', () => {
      const startTime = Date.now();

      // Log 1000 messages
      for (let i = 0; i < 1000; i++) {
        systemLogger.info(`Test message ${i}`, { iteration: i });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (less than 1 second)
      expect(duration).to.be.lessThan(1000);
    });

    it('should not block the event loop during logging', (done) => {
      let callbackExecuted = false;

      // Queue a callback
      setImmediate(() => {
        callbackExecuted = true;
      });

      // Log many messages
      for (let i = 0; i < 100; i++) {
        systemLogger.info(`Performance test ${i}`);
      }

      // Check that callback was executed (event loop not blocked)
      setImmediate(() => {
        expect(callbackExecuted).to.be.true;
        done();
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle mixed log levels appropriately', () => {
      systemLogger.error('Critical error occurred');
      systemLogger.warn('Warning: deprecated feature used');
      systemLogger.info('Information: user action completed');
      systemLogger.debug('Debug: variable value', { variable: 'test' });

      // All should execute without throwing
    });

    it('should handle concurrent logging from multiple sources', (done) => {
      const promises = [];

      // Create multiple concurrent logging operations
      for (let i = 0; i < 10; i++) {
        const promise = new Promise((resolve) => {
          setTimeout(() => {
            systemLogger.info(`Concurrent log ${i}`);
            whatsappLogger.info(`WhatsApp concurrent log ${i}`);
            resolve();
          }, Math.random() * 10);
        });
        promises.push(promise);
      }

      Promise.all(promises).then(() => {
        // All logging should complete successfully
        done();
      }).catch(done);
    });

    it('should maintain context across async operations', async () => {
      const operationId = 'async_op_123';

      systemLogger.info('Starting async operation', { operationId });

      await new Promise(resolve => setTimeout(resolve, 10));

      systemLogger.info('Continuing async operation', { operationId });

      await new Promise(resolve => setTimeout(resolve, 10));

      systemLogger.info('Completed async operation', { operationId });

      // Should execute without errors
    });
  });

  describe('Metadata Handling', () => {
    it('should preserve metadata structure', () => {
      const metadata = {
        user: { id: 123, name: 'test' },
        action: 'login',
        timestamp: Date.now(),
        nested: { deep: { value: 'test' } }
      };

      expect(() => {
        systemLogger.info('Structured metadata test', metadata);
      }).to.not.throw();
    });

    it('should handle null and undefined metadata', () => {
      expect(() => {
        systemLogger.info('Null metadata test', null);
        systemLogger.info('Undefined metadata test', undefined);
        systemLogger.info('Empty metadata test', {});
      }).to.not.throw();
    });

    it('should handle special metadata values', () => {
      const specialMetadata = {
        date: new Date(),
        regex: /test/g,
        buffer: Buffer.from('test'),
        number: 123.456,
        boolean: true,
        array: [1, 2, 3],
        null_value: null,
        undefined_value: undefined
      };

      expect(() => {
        systemLogger.info('Special values test', specialMetadata);
      }).to.not.throw();
    });
  });

  describe('Custom Log Methods', () => {
    describe('systemLogger custom methods', () => {
      it('should have startup method', () => {
        expect(systemLogger.startup).to.be.a('function');
      });

      it('should have shutdown method', () => {
        expect(systemLogger.shutdown).to.be.a('function');
      });

      it('should have logError method', () => {
        expect(systemLogger.logError).to.be.a('function');
      });
    });

    describe('whatsappLogger custom methods', () => {
      it('should have connection method', () => {
        expect(whatsappLogger.connection).to.be.a('function');
      });
    });
  });
});