require('dotenv').config();
const { systemLogger, whatsappLogger } = require('./utils/logger');
const env = require('./config/environment');

// Services
const ConfigService = require('./services/config.service');
const FilterService = require('./services/filter.service');
const TelegramService = require('./services/telegram.service');
const FileStorageService = require('./services/file-storage.service');
const NotificationDispatcherService = require('./services/notification-dispatcher.service');

// Core
const WhatsAppConnection = require('./core/whatsapp/connection');

// Repository
const MessageRepository = require('./repositories/message.repository');

// Models
const { MessageModel } = require('./models/message.model');

class MilesGuardApp {
  constructor() {
    this.services = {};
    this.whatsappConnection = null;
    this.isShuttingDown = false;
    this.startTime = Date.now();
    
    this.setupSignalHandlers();
  }

  async initialize() {
    try {
      systemLogger.startup('Initializing MilesGuard application', {
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL
      });

      // Initialize services in dependency order
      await this.initializeServices();
      
      // Initialize WhatsApp connection
      await this.initializeWhatsApp();
      
      // Setup inter-service communication
      this.setupServiceEvents();
      
      systemLogger.info('MilesGuard application initialized successfully');
      
      // Send ready signal to PM2 if available
      if (process.send) {
        process.send('ready');
      }
      
      return true;
      
    } catch (error) {
      systemLogger.logError('app_initialization', error);
      throw error;
    }
  }

  async initializeServices() {
    // Configuration service
    this.services.config = new ConfigService();
    
    try {
      await this.services.config.loadConfig();
      systemLogger.info('Configuration loaded successfully');
    } catch (error) {
      systemLogger.error('Configuration not found or invalid. Please run the setup wizard first.');
      throw new Error('Configuration required. Run: npm run config');
    }

    // Repository
    this.services.messageRepository = new MessageRepository();

    // Filter service
    this.services.filter = new FilterService(this.services.config);

    // Notification services
    this.services.telegram = new TelegramService();
    this.services.fileStorage = new FileStorageService(this.services.config);

    // Notification dispatcher
    this.services.notificationDispatcher = new NotificationDispatcherService(
      this.services.telegram,
      this.services.fileStorage,
      this.services.config
    );

    systemLogger.info('All services initialized successfully');
  }

  async initializeWhatsApp() {
    try {
      this.whatsappConnection = new WhatsAppConnection(this.services.config);
      
      // Setup connection event handlers
      this.whatsappConnection.on('connection:ready', () => {
        systemLogger.info('WhatsApp connection established and ready');
      });

      this.whatsappConnection.on('connection:failed', (error) => {
        systemLogger.logError('whatsapp_connection_failed', error);
        // Consider restarting the application or alerting
      });

      this.whatsappConnection.on('message:relevant', async (relevantMessage) => {
        await this.handleRelevantMessage(relevantMessage);
      });

      // Start the connection
      await this.whatsappConnection.connect();
      
    } catch (error) {
      systemLogger.logError('whatsapp_initialization', error);
      throw error;
    }
  }

  setupServiceEvents() {
    // Notification dispatcher events
    this.services.notificationDispatcher.on('dispatch:completed', (results) => {
      systemLogger.debug('Notification dispatch completed', results);
    });

    this.services.notificationDispatcher.on('retry:success', (data) => {
      systemLogger.info('Notification retry successful', data);
    });

    this.services.notificationDispatcher.on('retry:failed', (data) => {
      systemLogger.warn('Notification retry failed after max attempts', data);
    });
  }

  async handleRelevantMessage(relevantMessage) {
    try {
      // Create message model
      const messageModel = new MessageModel({
        id: relevantMessage.id,
        groupId: relevantMessage.groupId,
        groupName: relevantMessage.groupName,
        sender: relevantMessage.sender,
        text: relevantMessage.text,
        timestamp: relevantMessage.timestamp,
        matchedKeywords: relevantMessage.matchedKeywords,
        isRelevant: true
      });

      // Log the relevant message
      whatsappLogger.info('Relevant message processed', {
        groupName: relevantMessage.groupName,
        keywords: relevantMessage.matchedKeywords,
        sender: relevantMessage.sender,
        messageLength: relevantMessage.text.length
      });

      // Dispatch notifications
      const dispatchResult = await this.services.notificationDispatcher.dispatch(relevantMessage);
      
      // Save to repository for historical analysis
      try {
        await this.services.messageRepository.saveMessage(messageModel);
      } catch (repoError) {
        systemLogger.logError('message_repository_save', repoError, {
          messageId: relevantMessage.id
        });
        // Don't fail the whole process if repository save fails
      }

    } catch (error) {
      systemLogger.logError('relevant_message_handle', error, {
        messageId: relevantMessage.id
      });
    }
  }

  setupSignalHandlers() {
    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      systemLogger.logError('uncaught_exception', error);
      this.shutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      systemLogger.error('Unhandled promise rejection', { reason, promise });
      // Don't exit on unhandled rejection, just log it
    });
  }

  async shutdown(signal) {
    if (this.isShuttingDown) {
      systemLogger.warn('Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    this.isShuttingDown = true;
    systemLogger.shutdown(`Shutting down MilesGuard (${signal})`, {
      uptime: Date.now() - this.startTime,
      signal
    });

    try {
      // Shutdown services in reverse order
      if (this.whatsappConnection) {
        await this.whatsappConnection.disconnect();
      }

      if (this.services.notificationDispatcher) {
        await this.services.notificationDispatcher.shutdown();
      }

      if (this.services.telegram) {
        await this.services.telegram.shutdown();
      }

      if (this.services.fileStorage) {
        await this.services.fileStorage.shutdown();
      }

      systemLogger.info('MilesGuard shutdown completed successfully');
      process.exit(0);

    } catch (error) {
      systemLogger.logError('shutdown_error', error);
      process.exit(1);
    }
  }

  // Health check methods for monitoring
  getHealthStatus() {
    const uptime = Date.now() - this.startTime;
    const whatsappStats = this.whatsappConnection?.getConnectionStats();
    const dispatcherStats = this.services.notificationDispatcher?.getStats();
    const telegramStatus = this.services.telegram?.getQueueStatus();

    return {
      status: 'healthy',
      uptime: {
        ms: uptime,
        human: this.formatUptime(uptime)
      },
      services: {
        whatsapp: {
          connected: whatsappStats?.isConnected || false,
          groups: whatsappStats?.groupsCount || 0,
          targetGroups: whatsappStats?.targetGroupsCount || 0
        },
        notifications: {
          totalDispatched: dispatcherStats?.totalDispatched || 0,
          successRate: dispatcherStats?.successRate || { telegram: 'N/A', fileStorage: 'N/A' },
          retryQueue: dispatcherStats?.retryQueueSize || 0
        },
        telegram: {
          enabled: telegramStatus?.enabled || false,
          queueLength: telegramStatus?.queueLength || 0,
          processing: telegramStatus?.isProcessing || false
        }
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      process: {
        pid: process.pid,
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime()
      }
    };
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Get service references (for external access if needed)
  getServices() {
    return this.services;
  }

  getWhatsAppConnection() {
    return this.whatsappConnection;
  }
}

// Create and start the application
async function startApp() {
  try {
    const app = new MilesGuardApp();
    await app.initialize();
    
    // Keep the process alive
    process.stdin.resume();
    
    // Log periodic health status in development
    if (env.NODE_ENV === 'development') {
      setInterval(() => {
        const health = app.getHealthStatus();
        systemLogger.info('Health check', {
          uptime: health.uptime.human,
          whatsappConnected: health.services.whatsapp.connected,
          targetGroups: health.services.whatsapp.targetGroups,
          memoryMB: health.memory.used
        });
      }, 60000); // Every minute
    }

  } catch (error) {
    systemLogger.logError('app_start', error);
    process.exit(1);
  }
}

// Start the application only if this file is executed directly
if (require.main === module) {
  startApp();
}

module.exports = MilesGuardApp;