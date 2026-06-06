const EventEmitter = require('events');
const { notificationLogger } = require('../utils/logger');
const { sleep } = require('../utils/helpers');

class NotificationDispatcherService extends EventEmitter {
  constructor(telegramService, fileStorageService, configService) {
    super();
    this.telegramService = telegramService;
    this.fileStorageService = fileStorageService;
    this.configService = configService;
    
    this.retryQueue = new Map();
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.isProcessingRetries = false;
    
    this.stats = {
      totalDispatched: 0,
      telegramSuccess: 0,
      telegramFailed: 0,
      fileStorageSuccess: 0,
      fileStorageFailed: 0,
      retriesProcessed: 0
    };
    
    this.startRetryProcessor();
  }

  async dispatch(relevantMessage) {
    try {
      this.stats.totalDispatched++;
      
      const config = this.configService.getConfig();
      const results = {
        messageId: relevantMessage.id,
        timestamp: new Date().toISOString(),
        telegram: { attempted: false, success: false },
        fileStorage: { attempted: false, success: false },
        errors: []
      };

      // Create dispatch tasks based on configuration
      const tasks = [];

      // Telegram notification
      if (config.notification_enabled && config.telegram_enabled) {
        tasks.push(this.dispatchTelegram(relevantMessage, results));
      }

      // File storage
      if (config.notification_enabled && config.file_storage_enabled) {
        tasks.push(this.dispatchFileStorage(relevantMessage, results));
      }

      // Execute all tasks in parallel
      if (tasks.length > 0) {
        await Promise.allSettled(tasks);
      } else {
        notificationLogger.warn('No notification methods enabled, message will only be logged', {
          messageId: relevantMessage.id
        });
        // Mesmo sem métodos de notificação configurados, registrar a mensagem no log
        notificationLogger.info('Relevant message detected', {
          messageId: relevantMessage.id,
          groupName: relevantMessage.groupName,
          sender: relevantMessage.sender,
          textPreview: relevantMessage.text.substring(0, 100) + (relevantMessage.text.length > 100 ? '...' : '')
        });
      }

      // Log results
      this.logDispatchResults(results);
      
      // Emit completion event
      this.emit('dispatch:completed', results);
      
      return results;
      
    } catch (error) {
      notificationLogger.logError('dispatch_error', error, {
        messageId: relevantMessage.id
      });
      
      return {
        messageId: relevantMessage.id,
        timestamp: new Date().toISOString(),
        telegram: { attempted: false, success: false },
        fileStorage: { attempted: false, success: false },
        errors: [error.message]
      };
    }
  }

  async dispatchTelegram(relevantMessage, results) {
    try {
      results.telegram.attempted = true;
      
      const telegramResult = await this.telegramService.sendNotification(relevantMessage);
      results.telegram.success = telegramResult.success;
      
      if (telegramResult.success) {
        this.stats.telegramSuccess++;
        notificationLogger.info('Telegram notification sent successfully', {
          messageId: relevantMessage.id
        });
      } else {
        this.stats.telegramFailed++;
        results.errors.push(`Telegram: ${telegramResult.error || telegramResult.reason}`);
        
        // Add to retry queue if appropriate
        if (this.shouldRetry(telegramResult)) {
          await this.addToRetryQueue(relevantMessage, 'telegram', telegramResult);
        }
      }
      
    } catch (error) {
      this.stats.telegramFailed++;
      results.telegram.success = false;
      results.errors.push(`Telegram exception: ${error.message}`);
      
      notificationLogger.logError('telegram_dispatch', error, {
        messageId: relevantMessage.id
      });
    }
  }

  async dispatchFileStorage(relevantMessage, results) {
    try {
      results.fileStorage.attempted = true;
      
      const storageResult = await this.fileStorageService.saveMessage(relevantMessage);
      results.fileStorage.success = storageResult.success;
      
      if (storageResult.success) {
        this.stats.fileStorageSuccess++;
        notificationLogger.info('File storage completed successfully', {
          messageId: relevantMessage.id,
          buffered: storageResult.buffered
        });
      } else {
        this.stats.fileStorageFailed++;
        results.errors.push(`FileStorage: ${storageResult.error || storageResult.reason}`);
        
        // Add to retry queue if appropriate
        if (this.shouldRetry(storageResult)) {
          await this.addToRetryQueue(relevantMessage, 'fileStorage', storageResult);
        }
      }
      
    } catch (error) {
      this.stats.fileStorageFailed++;
      results.fileStorage.success = false;
      results.errors.push(`FileStorage exception: ${error.message}`);
      
      notificationLogger.logError('file_storage_dispatch', error, {
        messageId: relevantMessage.id
      });
    }
  }

  shouldRetry(result) {
    // Don't retry if service is disabled
    if (result.reason === 'service_disabled') {
      return false;
    }
    
    // Don't retry if it's a configuration error
    if (result.reason === 'config_error') {
      return false;
    }
    
    // Retry on network errors, rate limits, temporary failures
    return !result.success;
  }

  async addToRetryQueue(message, serviceType, originalResult) {
    const retryKey = `${message.id}-${serviceType}`;
    
    if (this.retryQueue.has(retryKey)) {
      const existing = this.retryQueue.get(retryKey);
      if (existing.attempts >= this.maxRetries) {
        return; // Already at max retries
      }
      existing.attempts++;
      existing.lastAttempt = Date.now();
    } else {
      this.retryQueue.set(retryKey, {
        message,
        serviceType,
        originalResult,
        attempts: 1,
        maxRetries: this.maxRetries,
        lastAttempt: Date.now(),
        nextRetry: Date.now() + this.retryDelay
      });
    }
    
    notificationLogger.info('Added to retry queue', {
      retryKey,
      attempts: this.retryQueue.get(retryKey).attempts,
      maxRetries: this.maxRetries
    });
  }

  startRetryProcessor() {
    if (this.isProcessingRetries) return;
    
    this.isProcessingRetries = true;
    this.processRetryQueue();
  }

  async processRetryQueue() {
    while (this.isProcessingRetries) {
      try {
        const now = Date.now();
        const readyToRetry = Array.from(this.retryQueue.entries())
          .filter(([, item]) => item.nextRetry <= now && item.attempts < item.maxRetries);
        
        for (const [retryKey, retryItem] of readyToRetry) {
          await this.processRetry(retryKey, retryItem);
        }
        
        // Clean up expired items
        for (const [key, item] of this.retryQueue.entries()) {
          if (item.attempts >= item.maxRetries || now - item.lastAttempt > 300000) { // 5 minutes
            this.retryQueue.delete(key);
          }
        }
        
      } catch (error) {
        notificationLogger.logError('retry_processor', error);
      }
      
      await sleep(10000); // Check every 10 seconds
    }
  }

  async processRetry(retryKey, retryItem) {
    try {
      this.stats.retriesProcessed++;
      
      notificationLogger.info('Processing retry', {
        retryKey,
        attempt: retryItem.attempts,
        maxRetries: retryItem.maxRetries
      });
      
      let success = false;
      
      if (retryItem.serviceType === 'telegram') {
        const result = await this.telegramService.sendNotification(retryItem.message);
        success = result.success;
      } else if (retryItem.serviceType === 'fileStorage') {
        const result = await this.fileStorageService.saveMessage(retryItem.message);
        success = result.success;
      }
      
      if (success) {
        notificationLogger.info('Retry successful', { retryKey });
        this.retryQueue.delete(retryKey);
        this.emit('retry:success', { retryKey, attempts: retryItem.attempts });
      } else {
        // Update retry info
        retryItem.attempts++;
        retryItem.lastAttempt = Date.now();
        retryItem.nextRetry = Date.now() + (this.retryDelay * Math.pow(2, retryItem.attempts - 1)); // Exponential backoff
        
        if (retryItem.attempts >= retryItem.maxRetries) {
          notificationLogger.warn('Retry max attempts reached', { retryKey });
          this.emit('retry:failed', { retryKey, attempts: retryItem.attempts });
        }
      }
      
    } catch (error) {
      notificationLogger.logError('retry_process', error, { retryKey });
      
      // Still increment attempt counter
      retryItem.attempts++;
      retryItem.lastAttempt = Date.now();
      retryItem.nextRetry = Date.now() + (this.retryDelay * Math.pow(2, retryItem.attempts - 1));
    }
  }

  logDispatchResults(results) {
    const status = [];
    
    if (results.telegram.attempted) {
      status.push(`Telegram: ${results.telegram.success ? '✅' : '❌'}`);
    }
    
    if (results.fileStorage.attempted) {
      status.push(`FileStorage: ${results.fileStorage.success ? '✅' : '❌'}`);
    }
    
    const level = results.errors.length === 0 ? 'info' : 'warn';
    
    notificationLogger[level]('Dispatch completed', {
      messageId: results.messageId,
      status: status.join(', '),
      errors: results.errors.length,
      errorDetails: results.errors
    });
  }

  // Statistics and monitoring
  getStats() {
    return {
      ...this.stats,
      retryQueueSize: this.retryQueue.size,
      successRate: {
        telegram: this.stats.telegramSuccess + this.stats.telegramFailed > 0 ? 
          (this.stats.telegramSuccess / (this.stats.telegramSuccess + this.stats.telegramFailed) * 100).toFixed(2) + '%' : 'N/A',
        fileStorage: this.stats.fileStorageSuccess + this.stats.fileStorageFailed > 0 ? 
          (this.stats.fileStorageSuccess / (this.stats.fileStorageSuccess + this.stats.fileStorageFailed) * 100).toFixed(2) + '%' : 'N/A'
      }
    };
  }

  getRetryQueueStatus() {
    const items = Array.from(this.retryQueue.values());
    return {
      totalItems: items.length,
      byService: {
        telegram: items.filter(i => i.serviceType === 'telegram').length,
        fileStorage: items.filter(i => i.serviceType === 'fileStorage').length
      },
      oldestItem: items.length > 0 ? 
        Math.min(...items.map(i => i.lastAttempt)) : null,
      averageAttempts: items.length > 0 ? 
        (items.reduce((sum, i) => sum + i.attempts, 0) / items.length).toFixed(1) : 0
    };
  }

  async clearRetryQueue() {
    const clearedCount = this.retryQueue.size;
    this.retryQueue.clear();
    
    notificationLogger.info('Retry queue cleared', { clearedCount });
    return clearedCount;
  }

  resetStats() {
    this.stats = {
      totalDispatched: 0,
      telegramSuccess: 0,
      telegramFailed: 0,
      fileStorageSuccess: 0,
      fileStorageFailed: 0,
      retriesProcessed: 0
    };
    
    notificationLogger.info('Dispatcher statistics reset');
  }

  async shutdown() {
    notificationLogger.info('Shutting down notification dispatcher');
    this.isProcessingRetries = false;
    
    // Process any remaining items in retry queue
    const retryPromises = Array.from(this.retryQueue.entries()).map(([key, item]) => 
      this.processRetry(key, item)
    );
    
    try {
      await Promise.allSettled(retryPromises);
    } catch (error) {
      notificationLogger.logError('shutdown_retry_processing', error);
    }
  }
}

module.exports = NotificationDispatcherService;