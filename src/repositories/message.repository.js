const fs = require('fs').promises;
const path = require('path');
const { systemLogger } = require('../utils/logger');
const { MessageModel, messageSummarySchema } = require('../models/message.model');
const { sanitizeFilename, formatTimestamp } = require('../utils/helpers');

class MessageRepository {
  constructor() {
    this.baseDir = './logs';
    this.messageCache = new Map(); // Cache for frequently accessed data
    this.cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    this.cacheCleanupInterval = 10 * 60 * 1000; // 10 minutes
    
    this.initialize();
  }

  async initialize() {
    try {
      await this.ensureBaseDirectory();
      this.startCacheCleanup();
      systemLogger.info('Message repository initialized', { baseDir: this.baseDir });
    } catch (error) {
      systemLogger.logError('repository_init', error);
      throw error;
    }
  }

  async ensureBaseDirectory() {
    await fs.mkdir(this.baseDir, { recursive: true });
  }

  async ensureDateDirectory(date) {
    const dateDir = path.join(this.baseDir, date);
    await fs.mkdir(dateDir, { recursive: true });
    return dateDir;
  }

  // Message CRUD operations
  async saveMessage(messageModel, date = null) {
    try {
      if (!(messageModel instanceof MessageModel)) {
        throw new Error('Invalid message model provided');
      }

      const messageDate = date || messageModel.timestamp.date.replace(/\//g, '-'); // Convert to YYYY-MM-DD
      const dateDir = await this.ensureDateDirectory(messageDate);
      const groupFileName = sanitizeFilename(messageModel.groupName);
      const filePath = path.join(dateDir, `${groupFileName}.json`);

      // Load existing data
      let fileData = { messages: [], summary: {} };
      try {
        const existingContent = await fs.readFile(filePath, 'utf8');
        fileData = JSON.parse(existingContent);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          systemLogger.warn('Error reading existing file, creating new one', { 
            filePath, 
            error: error.message 
          });
        }
      }

      // Add new message
      fileData.messages.push(messageModel.toStorageFormat());

      // Update summary
      fileData.summary = this.generateFileSummary(fileData.messages, messageModel.groupName);

      // Save updated data
      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2), 'utf8');

      // Update cache
      this.updateCache(`file:${messageDate}:${groupFileName}`, fileData);

      systemLogger.info('Message saved successfully', {
        messageId: messageModel.id,
        groupName: messageModel.groupName,
        date: messageDate,
        filePath
      });

      return { success: true, filePath };

    } catch (error) {
      systemLogger.logError('message_save', error, {
        messageId: messageModel?.id,
        groupName: messageModel?.groupName
      });
      throw error;
    }
  }

  async getMessagesByDateAndGroup(date, groupName, options = {}) {
    try {
      const groupFileName = sanitizeFilename(groupName);
      const cacheKey = `file:${date}:${groupFileName}`;
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached && !options.skipCache) {
        systemLogger.debug('Retrieved messages from cache', { date, groupName });
        return this.filterMessages(cached.messages, options);
      }

      const filePath = path.join(this.baseDir, date, `${groupFileName}.json`);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const fileData = JSON.parse(content);
        
        // Update cache
        this.updateCache(cacheKey, fileData);
        
        return this.filterMessages(fileData.messages || [], options);
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          return []; // File doesn't exist, return empty array
        }
        throw error;
      }

    } catch (error) {
      systemLogger.logError('messages_get', error, { date, groupName });
      throw error;
    }
  }

  async getMessageById(messageId, searchDate = null) {
    try {
      // If specific date provided, search only that date
      if (searchDate) {
        const groups = await this.getGroupsForDate(searchDate);
        for (const groupName of groups) {
          const messages = await this.getMessagesByDateAndGroup(searchDate, groupName);
          const message = messages.find(m => m.id === messageId);
          if (message) return message;
        }
        return null;
      }

      // Search recent dates (last 7 days)
      const recentDates = this.getRecentDateStrings(7);
      for (const date of recentDates) {
        const groups = await this.getGroupsForDate(date);
        for (const groupName of groups) {
          const messages = await this.getMessagesByDateAndGroup(date, groupName);
          const message = messages.find(m => m.id === messageId);
          if (message) return message;
        }
      }

      return null;

    } catch (error) {
      systemLogger.logError('message_get_by_id', error, { messageId });
      throw error;
    }
  }

  async getMessagesByKeyword(keyword, dateRange = null, groupName = null) {
    try {
      const dates = dateRange ? this.getDateRange(dateRange.start, dateRange.end) : 
        this.getRecentDateStrings(7);
      
      const results = [];
      
      for (const date of dates) {
        const groups = groupName ? [groupName] : await this.getGroupsForDate(date);
        
        for (const group of groups) {
          const messages = await this.getMessagesByDateAndGroup(date, group);
          const keywordMessages = messages.filter(message => 
            message.matchedKeywords?.includes(keyword) ||
            message.text.toLowerCase().includes(keyword.toLowerCase())
          );
          
          results.push(...keywordMessages.map(m => ({ ...m, date, groupName: group })));
        }
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return results;

    } catch (error) {
      systemLogger.logError('messages_get_by_keyword', error, { keyword });
      throw error;
    }
  }

  // Summary operations
  async getDailySummary(date) {
    try {
      const cacheKey = `summary:${date}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const groups = await this.getGroupsForDate(date);
      const summary = {
        date,
        totalMessages: 0,
        totalGroups: groups.length,
        groups: {},
        keywords: new Map(),
        senders: new Map(),
        hourlyActivity: {},
        messageStats: {
          avgLength: 0,
          totalCharacters: 0,
          longMessages: 0 // > 200 chars
        }
      };

      for (const groupName of groups) {
        const messages = await this.getMessagesByDateAndGroup(date, groupName);
        
        if (messages.length === 0) continue;

        summary.totalMessages += messages.length;
        summary.groups[groupName] = {
          count: messages.length,
          keywords: new Map(),
          topSenders: new Map()
        };

        // Process each message
        for (const message of messages) {
          // Keywords
          for (const keyword of message.matchedKeywords || []) {
            summary.keywords.set(keyword, (summary.keywords.get(keyword) || 0) + 1);
            summary.groups[groupName].keywords.set(keyword, 
              (summary.groups[groupName].keywords.get(keyword) || 0) + 1);
          }

          // Senders
          summary.senders.set(message.sender, (summary.senders.get(message.sender) || 0) + 1);
          summary.groups[groupName].topSenders.set(message.sender,
            (summary.groups[groupName].topSenders.get(message.sender) || 0) + 1);

          // Hourly activity
          const hour = new Date(message.timestamp).getHours();
          summary.hourlyActivity[hour] = (summary.hourlyActivity[hour] || 0) + 1;

          // Message stats
          const messageLength = message.messageLength || message.text?.length || 0;
          summary.messageStats.totalCharacters += messageLength;
          if (messageLength > 200) summary.messageStats.longMessages++;
        }

        // Convert Maps to sorted arrays for group data
        summary.groups[groupName].keywords = Array.from(summary.groups[groupName].keywords.entries())
          .sort(([,a], [,b]) => b - a)
          .map(([keyword, count]) => ({ keyword, count }));
        
        summary.groups[groupName].topSenders = Array.from(summary.groups[groupName].topSenders.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([sender, count]) => ({ sender, count }));
      }

      // Convert Maps to sorted arrays for overall data
      summary.keywords = Array.from(summary.keywords.entries())
        .sort(([,a], [,b]) => b - a)
        .map(([keyword, count]) => ({ keyword, count }));
      
      summary.senders = Array.from(summary.senders.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([sender, count]) => ({ sender, count }));

      // Calculate average message length
      summary.messageStats.avgLength = summary.totalMessages > 0 ? 
        Math.round(summary.messageStats.totalCharacters / summary.totalMessages) : 0;

      // Cache the result
      this.updateCache(cacheKey, summary);

      return summary;

    } catch (error) {
      systemLogger.logError('daily_summary_get', error, { date });
      throw error;
    }
  }

  async getWeeklySummary(startDate) {
    try {
      const dates = this.getDateRange(startDate, this.addDays(startDate, 6));
      const dailySummaries = await Promise.all(dates.map(date => this.getDailySummary(date)));
      
      const weeklySummary = {
        period: `${startDate} to ${this.addDays(startDate, 6)}`,
        totalMessages: 0,
        totalGroups: new Set(),
        dailyBreakdown: [],
        keywords: new Map(),
        peakHours: {},
        trends: {}
      };

      for (const daily of dailySummaries) {
        weeklySummary.totalMessages += daily.totalMessages;
        Object.keys(daily.groups).forEach(group => weeklySummary.totalGroups.add(group));
        
        weeklySummary.dailyBreakdown.push({
          date: daily.date,
          messages: daily.totalMessages,
          groups: Object.keys(daily.groups).length
        });

        // Aggregate keywords
        for (const { keyword, count } of daily.keywords) {
          weeklySummary.keywords.set(keyword, (weeklySummary.keywords.get(keyword) || 0) + count);
        }
      }

      weeklySummary.totalGroups = weeklySummary.totalGroups.size;
      weeklySummary.keywords = Array.from(weeklySummary.keywords.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
        .map(([keyword, count]) => ({ keyword, count }));

      return weeklySummary;

    } catch (error) {
      systemLogger.logError('weekly_summary_get', error, { startDate });
      throw error;
    }
  }

  // Utility methods
  async getGroupsForDate(date) {
    try {
      const dateDir = path.join(this.baseDir, date);
      const files = await fs.readdir(dateDir);
      
      return files
        .filter(file => file.endsWith('.json') && file !== 'resumo-diario.txt')
        .map(file => {
          // Convert back from sanitized filename - this is approximate
          const groupName = file.replace('.json', '').replace(/_/g, ' ');
          return groupName.charAt(0).toUpperCase() + groupName.slice(1);
        });
        
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getAvailableDates() {
    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name)) // YYYY-MM-DD format
        .sort()
        .reverse(); // Newest first
        
    } catch (error) {
      systemLogger.logError('available_dates_get', error);
      return [];
    }
  }

  // Helper methods
  filterMessages(messages, options = {}) {
    let filtered = [...messages];

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    if (options.keyword) {
      filtered = filtered.filter(message => 
        message.matchedKeywords?.includes(options.keyword) ||
        message.text.toLowerCase().includes(options.keyword.toLowerCase())
      );
    }

    if (options.sender) {
      filtered = filtered.filter(message => 
        message.sender.toLowerCase().includes(options.sender.toLowerCase())
      );
    }

    if (options.timeRange) {
      const start = new Date(options.timeRange.start);
      const end = new Date(options.timeRange.end);
      filtered = filtered.filter(message => {
        const messageTime = new Date(message.timestamp);
        return messageTime >= start && messageTime <= end;
      });
    }

    return filtered;
  }

  generateFileSummary(messages, groupName) {
    if (!messages || messages.length === 0) {
      return {
        groupName,
        totalMessages: 0,
        lastUpdate: new Date().toISOString()
      };
    }

    const keywords = new Map();
    const senders = new Map();
    let totalCharacters = 0;

    for (const message of messages) {
      // Keywords
      for (const keyword of message.matchedKeywords || []) {
        keywords.set(keyword, (keywords.get(keyword) || 0) + 1);
      }

      // Senders
      senders.set(message.sender, (senders.get(message.sender) || 0) + 1);

      // Character count
      totalCharacters += message.messageLength || message.text?.length || 0;
    }

    const timestamps = messages.map(m => new Date(m.timestamp || m.processed_at));
    
    return {
      groupName,
      totalMessages: messages.length,
      lastUpdate: new Date().toISOString(),
      dateRange: {
        earliest: new Date(Math.min(...timestamps)).toISOString(),
        latest: new Date(Math.max(...timestamps)).toISOString()
      },
      keywordStats: Array.from(keywords.entries())
        .sort(([,a], [,b]) => b - a)
        .map(([keyword, count]) => ({ keyword, count })),
      senderStats: Array.from(senders.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([sender, count]) => ({ sender, count })),
      avgMessageLength: Math.round(totalCharacters / messages.length)
    };
  }

  // Date utility methods
  getRecentDateStrings(days) {
    const dates = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }

  getDateRange(startDate, endDate) {
    const dates = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  // Cache management
  updateCache(key, data) {
    this.messageCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  getFromCache(key) {
    const cached = this.messageCache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.messageCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  startCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      for (const [key, value] of this.messageCache.entries()) {
        if (now - value.timestamp > this.cacheMaxAge) {
          this.messageCache.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        systemLogger.debug('Cache cleaned up', { cleanedCount, remainingCount: this.messageCache.size });
      }
    }, this.cacheCleanupInterval);
  }

  // Maintenance operations
  async cleanupOldFiles(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffString = cutoffDate.toISOString().split('T')[0];
      
      const dates = await this.getAvailableDates();
      let cleanedCount = 0;
      
      for (const date of dates) {
        if (date < cutoffString) {
          const dateDir = path.join(this.baseDir, date);
          await fs.rm(dateDir, { recursive: true, force: true });
          cleanedCount++;
        }
      }
      
      systemLogger.info('Old files cleaned up', { cleanedCount, retentionDays });
      return cleanedCount;
      
    } catch (error) {
      systemLogger.logError('file_cleanup', error);
      return 0;
    }
  }

  getCacheStats() {
    return {
      size: this.messageCache.size,
      maxAge: this.cacheMaxAge,
      cleanupInterval: this.cacheCleanupInterval
    };
  }

  clearCache() {
    const size = this.messageCache.size;
    this.messageCache.clear();
    systemLogger.info('Cache cleared', { clearedCount: size });
    return size;
  }
}

module.exports = MessageRepository;