const { normalizeText } = require('../utils/helpers');
const { systemLogger } = require('../utils/logger');

class FilterService {
  constructor(configService) {
    if (!configService) {
      throw new Error('ConfigService é obrigatório');
    }
    this.configService = configService;
    this.pausedGroups = new Set();
    this.pausedKeywords = new Set();
    this.globalPaused = false;
    this.stats = {
      messagesProcessed: 0,
      messagesMatched: 0,
      messagesRejected: 0,
      keywordMatches: new Map(),
      groupMatches: new Map()
    };
  }

  shouldProcessMessage(message, groupName) {
    try {
      // Input validation
      if (!message) {
        return { shouldProcess: false, reason: 'invalid_message' };
      }

      this.stats.messagesProcessed++;

      // Check if globally paused
      if (this.globalPaused) {
        this.stats.messagesRejected++;
        return { shouldProcess: false, reason: 'globally_paused' };
      }

      // Check if group is paused
      if (this.pausedGroups.has(groupName)) {
        this.stats.messagesRejected++;
        return { shouldProcess: false, reason: 'group_paused' };
      }

      // Check if this is a target group
      if (!this.isTargetGroup(groupName)) {
        this.stats.messagesRejected++;
        return { shouldProcess: false, reason: 'not_target_group' };
      }

      // Check keyword matches
      const keywordResult = this.matchesKeywords(message.text);
      
      if (keywordResult.matched) {
        this.stats.messagesMatched++;
        this.updateKeywordStats(keywordResult.matchedKeywords);
        this.updateGroupStats(groupName);
        
        return {
          shouldProcess: true,
          matchedKeywords: keywordResult.matchedKeywords,
          reason: 'keyword_match'
        };
      } else {
        this.stats.messagesRejected++;
        return { shouldProcess: false, reason: 'no_keyword_match' };
      }

    } catch (error) {
      systemLogger.logError('filter_process', error, { groupName, messageId: message.id });
      this.stats.messagesRejected++;
      return { shouldProcess: false, reason: 'filter_error' };
    }
  }

  matchesKeywords(text) {
    if (!text || typeof text !== 'string') {
      return { matched: false, matchedKeywords: [] };
    }

    const config = this.configService.getConfig();
    if (!config || !config.palavras_chave || config.palavras_chave.length === 0) {
      return { matched: false, matchedKeywords: [] };
    }

    // Normalize text for searching
    const normalizedText = config.case_sensitive ? text : normalizeText(text);
    const matchedKeywords = [];

    for (const keyword of config.palavras_chave) {
      // Skip paused keywords
      if (this.pausedKeywords.has(keyword)) {
        continue;
      }

      const normalizedKeyword = config.case_sensitive ? keyword : normalizeText(keyword);
      
      if (normalizedText.includes(normalizedKeyword)) {
        matchedKeywords.push(keyword);
      }
    }

    return {
      matched: matchedKeywords.length > 0,
      matchedKeywords
    };
  }

  isTargetGroup(groupName) {
    if (!groupName) return false;
    return this.configService.isTargetGroup(groupName);
  }

  // Dynamic filter controls
  pauseGroup(groupName) {
    this.pausedGroups.add(groupName);
    systemLogger.info('Group paused from filtering', { groupName });
  }

  resumeGroup(groupName) {
    this.pausedGroups.delete(groupName);
    systemLogger.info('Group resumed for filtering', { groupName });
  }

  pauseKeyword(keyword) {
    this.pausedKeywords.add(keyword);
    systemLogger.info('Keyword paused from filtering', { keyword });
  }

  resumeKeyword(keyword) {
    this.pausedKeywords.delete(keyword);
    systemLogger.info('Keyword resumed for filtering', { keyword });
  }

  toggleGlobalPause() {
    this.globalPaused = !this.globalPaused;
    systemLogger.info(`Global filtering ${this.globalPaused ? 'paused' : 'resumed'}`);
    return this.globalPaused;
  }

  // Statistics helpers
  updateKeywordStats(keywords) {
    for (const keyword of keywords) {
      const current = this.stats.keywordMatches.get(keyword) || 0;
      this.stats.keywordMatches.set(keyword, current + 1);
    }
  }

  updateGroupStats(groupName) {
    const current = this.stats.groupMatches.get(groupName) || 0;
    this.stats.groupMatches.set(groupName, current + 1);
  }

  getStats() {
    const totalProcessed = this.stats.messagesProcessed;
    const matchRate = totalProcessed > 0 ? (this.stats.messagesMatched / totalProcessed * 100).toFixed(2) : 0;
    
    return {
      processed: this.stats.messagesProcessed,
      matched: this.stats.messagesMatched,
      rejected: this.stats.messagesRejected,
      matchRate: `${matchRate}%`,
      topKeywords: this.getTopKeywords(5),
      topGroups: this.getTopGroups(5),
      pausedGroups: Array.from(this.pausedGroups),
      pausedKeywords: Array.from(this.pausedKeywords),
      globalPaused: this.globalPaused
    };
  }

  getTopKeywords(limit = 10) {
    return Array.from(this.stats.keywordMatches.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  getTopGroups(limit = 10) {
    return Array.from(this.stats.groupMatches.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([group, count]) => ({ group, count }));
  }

  resetStats() {
    this.stats = {
      messagesProcessed: 0,
      messagesMatched: 0,
      messagesRejected: 0,
      keywordMatches: new Map(),
      groupMatches: new Map()
    };
    systemLogger.info('Filter statistics reset');
  }

  validateMessage(message) {
    if (!message) return false;
    if (!message.text || typeof message.text !== 'string') return false;
    if (message.text.trim().length === 0) return false;
    return true;
  }

  // Advanced filtering methods
  getKeywordContext(text, keyword, contextLength = 50) {
    if (!text || !keyword) return '';
    
    const normalizedText = normalizeText(text);
    const normalizedKeyword = normalizeText(keyword);
    const index = normalizedText.indexOf(normalizedKeyword);
    
    if (index === -1) return '';
    
    const start = Math.max(0, index - contextLength);
    const end = Math.min(text.length, index + keyword.length + contextLength);
    
    return text.substring(start, end);
  }

  analyzeMessage(message, groupName) {
    const analysis = {
      messageLength: message.text?.length || 0,
      groupName,
      timestamp: new Date().toISOString(),
      keywordAnalysis: [],
      groupMatch: this.isTargetGroup(groupName)
    };

    if (message.text) {
      const config = this.configService.getConfig();
      
      for (const keyword of config.palavras_chave) {
        const normalizedText = config.case_sensitive ? message.text : normalizeText(message.text);
        const normalizedKeyword = config.case_sensitive ? keyword : normalizeText(keyword);
        
        if (normalizedText.includes(normalizedKeyword)) {
          analysis.keywordAnalysis.push({
            keyword,
            context: this.getKeywordContext(message.text, keyword),
            position: normalizedText.indexOf(normalizedKeyword)
          });
        }
      }
    }

    return analysis;
  }

  // Legacy methods for backward compatibility with tests
  getMatchedKeywords(text) {
    const result = this.matchesKeywords(text);
    return result.matchedKeywords;
  }

  filterMessages(messages) {
    if (!messages || !Array.isArray(messages)) {
      return [];
    }

    return messages.filter(message => {
      if (!message || !message.groupName) return false;
      const result = this.shouldProcessMessage(message, message.groupName);
      return result.shouldProcess;
    });
  }

  createRelevantMessage(message) {
    const matchedKeywords = this.getMatchedKeywords(message.text);
    return {
      ...message,
      timestamp: message.timestamp || Date.now(),
      matchedKeywords,
      isRelevant: true
    };
  }

  getFilterStats() {
    return {
      totalProcessed: this.stats.messagesProcessed,
      relevantFound: this.stats.messagesMatched,
      relevantRate: this.stats.messagesProcessed > 0 ? 
        (this.stats.messagesMatched / this.stats.messagesProcessed * 100).toFixed(2) : 0
    };
  }
}

module.exports = FilterService;