const EventEmitter = require('events');
const { whatsappLogger } = require('../../utils/logger');
const { 
  getMessageText, 
  isSystemMessage, 
  extractSenderName, 
  extractGroupName,
  formatTimestamp,
  createMessageFingerprint
} = require('../../utils/helpers');

class MessageHandler extends EventEmitter {
  constructor(filterService, configService) {
    super();
    this.filterService = filterService;
    this.configService = configService;
    this.messageCache = new Map(); // For deduplication
    this.cacheCleanupInterval = 30 * 60 * 1000; // 30 minutes
    
    // Start cache cleanup
    this.startCacheCleanup();
  }

  async handleMessages(messageUpdate) {
    const { messages } = messageUpdate;
    
    for (const message of messages) {
      try {
        await this.processMessage(message);
      } catch (error) {
        whatsappLogger.logError('message_process', error, { 
          messageId: message.key?.id 
        });
      }
    }
  }

  async processMessage(message) {
    // Basic validation
    if (!message.key?.remoteJid || !message.message) {
      return;
    }

    // Skip system messages
    if (isSystemMessage(message)) {
      return;
    }

    // Extract message information
    const groupId = message.key.remoteJid;
    const messageText = getMessageText(message);
    const senderName = extractSenderName(message);
    const timestamp = formatTimestamp(message.messageTimestamp || Math.floor(Date.now() / 1000));

    if (!messageText || messageText.trim().length === 0) {
      return;
    }

    // Check for duplicates
    const fingerprint = createMessageFingerprint(message);
    if (fingerprint && this.messageCache.has(fingerprint)) {
      whatsappLogger.debug('Duplicate message detected, skipping', { fingerprint });
      return;
    }

    // Add to cache
    if (fingerprint) {
      this.messageCache.set(fingerprint, Date.now());
    }

    // Check if this is a group message
    if (!groupId.includes('@g.us')) {
      return; // Skip non-group messages
    }

    const processedMessage = {
      id: message.key.id,
      groupId,
      groupName: null, // Will be set by connection service
      sender: senderName,
      text: messageText,
      timestamp: timestamp,
      raw: message
    };

    whatsappLogger.message(processedMessage.groupName || 'Unknown Group', senderName, messageText.length);

    // Emit for further processing
    this.emit('message:received', processedMessage);
  }

  async filterAndProcessMessage(processedMessage, groupsMap) {
    try {
      // Get group information
      const group = groupsMap.get(processedMessage.groupId);
      if (!group) {
        return;
      }

      processedMessage.groupName = extractGroupName(group);

      // Check if this is a target group
      const isTargetGroup = this.configService.isTargetGroup(processedMessage.groupName);
      
      if (!isTargetGroup) {
        whatsappLogger.debug('Message from non-target group', { 
          groupName: processedMessage.groupName 
        });
        return;
      }

      // Apply keyword filtering
      const matchedKeywords = this.configService.getMatchedKeywords(processedMessage.text);
      const hasKeywordMatch = matchedKeywords.length > 0;

      whatsappLogger.filter(processedMessage.groupName, hasKeywordMatch, matchedKeywords);

      if (hasKeywordMatch) {
        const relevantMessage = {
          ...processedMessage,
          matchedKeywords,
          isRelevant: true
        };

        // Emit relevant message for notification
        this.emit('message:relevant', relevantMessage);
      }
    } catch (error) {
      whatsappLogger.logError('message_filter', error, { 
        messageId: processedMessage.id 
      });
    }
  }

  startCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, this.cacheCleanupInterval);
  }

  cleanupCache() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    let cleanedCount = 0;
    for (const [fingerprint, timestamp] of this.messageCache.entries()) {
      if (now - timestamp > maxAge) {
        this.messageCache.delete(fingerprint);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      whatsappLogger.debug('Cleaned up message cache', { 
        cleanedCount, 
        remainingCount: this.messageCache.size 
      });
    }
  }

  getCacheStats() {
    return {
      size: this.messageCache.size,
      maxAge: '1 hour',
      cleanupInterval: '30 minutes'
    };
  }
}

module.exports = MessageHandler;