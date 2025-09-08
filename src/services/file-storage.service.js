const fs = require('fs').promises;
const path = require('path');
const { notificationLogger } = require('../utils/logger');
const { formatTimestamp, sanitizeFilename } = require('../utils/helpers');

class FileStorageService {
  constructor(configService) {
    this.configService = configService;
    this.baseLogDir = './logs';
    this.isEnabled = true;
    this.messageBuffer = new Map(); // Group messages by date/group for batching
    this.bufferFlushInterval = 30000; // 30 seconds
    this.maxBufferSize = 100;
    
    this.initialize();
  }

  async initialize() {
    try {
      await this.ensureBaseDirectory();
      this.startBufferFlusher();
      notificationLogger.info('File storage service initialized', { 
        baseDir: this.baseLogDir 
      });
    } catch (error) {
      notificationLogger.logError('storage_init', error);
      this.isEnabled = false;
    }
  }

  async ensureBaseDirectory() {
    await fs.mkdir(this.baseLogDir, { recursive: true });
  }

  async saveMessage(relevantMessage) {
    if (!this.isEnabled) {
      return { success: false, reason: 'service_disabled' };
    }

    try {
      const date = new Date();
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const groupFileName = sanitizeFilename(relevantMessage.groupName);
      
      // Add to buffer for batching
      const bufferKey = `${dateString}-${groupFileName}`;
      
      if (!this.messageBuffer.has(bufferKey)) {
        this.messageBuffer.set(bufferKey, {
          date: dateString,
          groupName: relevantMessage.groupName,
          groupFileName,
          messages: [],
          lastUpdate: Date.now()
        });
      }
      
      const bufferEntry = this.messageBuffer.get(bufferKey);
      bufferEntry.messages.push(this.formatMessageForStorage(relevantMessage));
      bufferEntry.lastUpdate = Date.now();
      
      // Flush if buffer is getting large
      if (bufferEntry.messages.length >= this.maxBufferSize) {
        await this.flushBuffer(bufferKey);
      }
      
      return { success: true, buffered: true };
      
    } catch (error) {
      notificationLogger.logError('message_save', error, { 
        messageId: relevantMessage.id 
      });
      return { success: false, error: error.message };
    }
  }

  formatMessageForStorage(message) {
    return {
      id: message.id,
      timestamp: message.timestamp?.iso || new Date().toISOString(),
      sender: message.sender,
      text: message.text,
      matchedKeywords: message.matchedKeywords || [],
      groupId: message.groupId,
      groupName: message.groupName,
      messageLength: message.text?.length || 0,
      processed_at: new Date().toISOString()
    };
  }

  startBufferFlusher() {
    setInterval(async () => {
      await this.flushAllBuffers();
    }, this.bufferFlushInterval);
  }

  async flushAllBuffers() {
    const bufferKeys = Array.from(this.messageBuffer.keys());
    const flushPromises = bufferKeys.map(key => this.flushBuffer(key));
    
    try {
      await Promise.all(flushPromises);
    } catch (error) {
      notificationLogger.logError('buffer_flush_all', error);
    }
  }

  async flushBuffer(bufferKey) {
    const bufferEntry = this.messageBuffer.get(bufferKey);
    if (!bufferEntry || bufferEntry.messages.length === 0) {
      return;
    }

    try {
      // Create date directory
      const dateDir = path.join(this.baseLogDir, bufferEntry.date);
      await fs.mkdir(dateDir, { recursive: true });
      
      // Save JSON file with messages
      const jsonFile = path.join(dateDir, `${bufferEntry.groupFileName}.json`);
      await this.saveMessagesJson(jsonFile, bufferEntry.messages, bufferEntry.groupName);
      
      // Update daily summary
      await this.updateDailySummary(bufferEntry.date, bufferEntry.messages, bufferEntry.groupName);
      
      // Clear buffer
      this.messageBuffer.delete(bufferKey);
      
      notificationLogger.info('Buffer flushed successfully', {
        bufferKey,
        messageCount: bufferEntry.messages.length,
        file: jsonFile
      });
      
    } catch (error) {
      notificationLogger.logError('buffer_flush', error, { bufferKey });
    }
  }

  async saveMessagesJson(filePath, newMessages, groupName) {
    let existingData = { messages: [], summary: {} };
    
    // Load existing data if file exists
    try {
      const existingContent = await fs.readFile(filePath, 'utf8');
      existingData = JSON.parse(existingContent);
    } catch (error) {
      // File doesn't exist or is invalid, use empty data
      if (error.code !== 'ENOENT') {
        notificationLogger.warn('Error reading existing JSON file, creating new one', { 
          file: filePath, 
          error: error.message 
        });
      }
    }
    
    // Merge new messages
    existingData.messages = (existingData.messages || []).concat(newMessages);
    
    // Update summary
    existingData.summary = {
      groupName,
      totalMessages: existingData.messages.length,
      lastUpdate: new Date().toISOString(),
      dateRange: this.getDateRange(existingData.messages),
      keywordStats: this.generateKeywordStats(existingData.messages),
      senderStats: this.generateSenderStats(existingData.messages)
    };
    
    // Save updated data
    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2), 'utf8');
  }

  async updateDailySummary(date, newMessages, groupName) {
    try {
      const summaryFile = path.join(this.baseLogDir, date, 'resumo-diario.txt');
      
      // Load existing summary data
      let summaryData = await this.loadDailySummaryData(date);
      
      // Add new messages to summary
      for (const message of newMessages) {
        if (!summaryData.groups[groupName]) {
          summaryData.groups[groupName] = { count: 0, keywords: new Map() };
        }
        
        summaryData.groups[groupName].count++;
        summaryData.totalMessages++;
        
        // Count keywords
        for (const keyword of message.matchedKeywords) {
          if (!summaryData.keywords.has(keyword)) {
            summaryData.keywords.set(keyword, 0);
          }
          summaryData.keywords.set(keyword, summaryData.keywords.get(keyword) + 1);
          
          if (!summaryData.groups[groupName].keywords.has(keyword)) {
            summaryData.groups[groupName].keywords.set(keyword, 0);
          }
          summaryData.groups[groupName].keywords.set(keyword, 
            summaryData.groups[groupName].keywords.get(keyword) + 1);
        }
        
        // Track hourly activity
        const hour = new Date(message.timestamp).getHours();
        summaryData.hourlyActivity[hour] = (summaryData.hourlyActivity[hour] || 0) + 1;
      }
      
      // Generate and save summary text
      const summaryText = this.generateDailySummaryText(date, summaryData);
      await fs.writeFile(summaryFile, summaryText, 'utf8');
      
    } catch (error) {
      notificationLogger.logError('daily_summary_update', error, { date });
    }
  }

  async loadDailySummaryData(date) {
    const summaryData = {
      date,
      totalMessages: 0,
      groups: {},
      keywords: new Map(),
      hourlyActivity: {}
    };
    
    try {
      // Try to load existing group files to rebuild summary
      const dateDir = path.join(this.baseLogDir, date);
      const files = await fs.readdir(dateDir);
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'resumo-diario.json') {
          const filePath = path.join(dateDir, file);
          const fileContent = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(fileContent);
          
          if (data.messages) {
            for (const message of data.messages) {
              const groupName = message.groupName;
              
              if (!summaryData.groups[groupName]) {
                summaryData.groups[groupName] = { count: 0, keywords: new Map() };
              }
              
              summaryData.groups[groupName].count++;
              summaryData.totalMessages++;
              
              for (const keyword of message.matchedKeywords || []) {
                summaryData.keywords.set(keyword, (summaryData.keywords.get(keyword) || 0) + 1);
                summaryData.groups[groupName].keywords.set(keyword,
                  (summaryData.groups[groupName].keywords.get(keyword) || 0) + 1);
              }
              
              const hour = new Date(message.timestamp).getHours();
              summaryData.hourlyActivity[hour] = (summaryData.hourlyActivity[hour] || 0) + 1;
            }
          }
        }
      }
    } catch (error) {
      // Directory or files don't exist yet, return empty summary
    }
    
    return summaryData;
  }

  generateDailySummaryText(date, data) {
    let summary = `# RESUMO DIÁRIO - MilesGuard\n`;
    summary += `Data: ${new Date(date).toLocaleDateString('pt-BR')}\n`;
    summary += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    summary += `## 📊 ESTATÍSTICAS GERAIS\n`;
    summary += `Total de mensagens relevantes: ${data.totalMessages}\n`;
    summary += `Grupos monitorados: ${Object.keys(data.groups).length}\n\n`;
    
    if (Object.keys(data.groups).length > 0) {
      summary += `## 📱 ATIVIDADE POR GRUPO\n`;
      const groupEntries = Object.entries(data.groups)
        .sort(([,a], [,b]) => b.count - a.count);
      
      for (const [groupName, groupData] of groupEntries) {
        summary += `\n### ${groupName}\n`;
        summary += `- Mensagens: ${groupData.count}\n`;
        
        if (groupData.keywords.size > 0) {
          const topKeywords = Array.from(groupData.keywords.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5);
          
          summary += `- Top palavras-chave: ${topKeywords.map(([k, c]) => `${k}(${c})`).join(', ')}\n`;
        }
      }
    }
    
    if (data.keywords.size > 0) {
      summary += `\n## 🔍 TOP PALAVRAS-CHAVE\n`;
      const topKeywords = Array.from(data.keywords.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      for (const [keyword, count] of topKeywords) {
        summary += `- ${keyword}: ${count} ocorrências\n`;
      }
    }
    
    // Hourly activity
    const activeHours = Object.entries(data.hourlyActivity)
      .filter(([,count]) => count > 0)
      .sort(([,a], [,b]) => b - a);
    
    if (activeHours.length > 0) {
      summary += `\n## ⏰ ATIVIDADE POR HORA\n`;
      for (const [hour, count] of activeHours.slice(0, 5)) {
        summary += `- ${hour}h: ${count} mensagens\n`;
      }
    }
    
    summary += `\n---\nRelatório gerado automaticamente pelo MilesGuard\n`;
    
    return summary;
  }

  // Utility methods
  getDateRange(messages) {
    if (!messages || messages.length === 0) return null;
    
    const timestamps = messages.map(m => new Date(m.timestamp));
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    
    return {
      earliest: earliest.toISOString(),
      latest: latest.toISOString(),
      span: `${earliest.toLocaleString('pt-BR')} - ${latest.toLocaleString('pt-BR')}`
    };
  }

  generateKeywordStats(messages) {
    const stats = new Map();
    
    for (const message of messages) {
      for (const keyword of message.matchedKeywords || []) {
        stats.set(keyword, (stats.get(keyword) || 0) + 1);
      }
    }
    
    return Array.from(stats.entries())
      .sort(([,a], [,b]) => b - a)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  generateSenderStats(messages) {
    const stats = new Map();
    
    for (const message of messages) {
      stats.set(message.sender, (stats.get(message.sender) || 0) + 1);
    }
    
    return Array.from(stats.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([sender, count]) => ({ sender, count }));
  }

  async cleanupOldLogs(retentionDays = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      const entries = await fs.readdir(this.baseLogDir, { withFileTypes: true });
      let cleanedCount = 0;
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirDate = new Date(entry.name);
          if (dirDate < cutoffDate) {
            const dirPath = path.join(this.baseLogDir, entry.name);
            await fs.rm(dirPath, { recursive: true, force: true });
            cleanedCount++;
          }
        }
      }
      
      notificationLogger.info('Old logs cleaned up', { 
        cleanedCount, 
        retentionDays 
      });
      
      return cleanedCount;
      
    } catch (error) {
      notificationLogger.logError('log_cleanup', error);
      return 0;
    }
  }

  getStorageStats() {
    return {
      enabled: this.isEnabled,
      baseDir: this.baseLogDir,
      bufferedGroups: this.messageBuffer.size,
      totalBufferedMessages: Array.from(this.messageBuffer.values())
        .reduce((sum, entry) => sum + entry.messages.length, 0),
      flushInterval: this.bufferFlushInterval,
      maxBufferSize: this.maxBufferSize
    };
  }

  async shutdown() {
    notificationLogger.info('Shutting down file storage service');
    
    // Flush all remaining buffers
    await this.flushAllBuffers();
  }
}

module.exports = FileStorageService;