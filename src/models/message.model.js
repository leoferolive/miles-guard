const { z } = require('zod');

// Message model schema for validation
const messageSchema = z.object({
  id: z.string().min(1, 'Message ID is required'),
  groupId: z.string().min(1, 'Group ID is required'),
  groupName: z.string().min(1, 'Group name is required'),
  sender: z.string().min(1, 'Sender is required'),
  text: z.string().min(1, 'Message text is required'),
  timestamp: z.object({
    time: z.string(),
    date: z.string(),
    iso: z.string(),
    unix: z.number()
  }),
  matchedKeywords: z.array(z.string()).default([]),
  isRelevant: z.boolean().default(false),
  messageLength: z.number().int().min(0).optional(),
  processed_at: z.string().optional(),
  raw: z.any().optional() // Original WhatsApp message object
});

// Processed message schema (after filtering)
const processedMessageSchema = messageSchema.extend({
  isRelevant: z.boolean(),
  matchedKeywords: z.array(z.string()).min(1),
  filterReason: z.string().optional(),
  processingTime: z.number().optional()
});

// Message summary schema for daily reports
const messageSummarySchema = z.object({
  date: z.string(),
  groupName: z.string(),
  totalMessages: z.number().int().min(0),
  messageIds: z.array(z.string()),
  keywordStats: z.array(z.object({
    keyword: z.string(),
    count: z.number().int().min(0)
  })),
  senderStats: z.array(z.object({
    sender: z.string(),
    count: z.number().int().min(0)
  })),
  timeRange: z.object({
    earliest: z.string(),
    latest: z.string(),
    span: z.string()
  }).optional(),
  avgMessageLength: z.number().optional(),
  lastUpdate: z.string()
});

class MessageModel {
  constructor(data) {
    this.data = messageSchema.parse(data);
  }

  // Getters
  get id() { return this.data.id; }
  get groupId() { return this.data.groupId; }
  get groupName() { return this.data.groupName; }
  get sender() { return this.data.sender; }
  get text() { return this.data.text; }
  get timestamp() { return this.data.timestamp; }
  get matchedKeywords() { return this.data.matchedKeywords; }
  get isRelevant() { return this.data.isRelevant; }
  get messageLength() { return this.data.messageLength || this.data.text.length; }

  // Methods
  toJSON() {
    return {
      ...this.data,
      messageLength: this.messageLength
    };
  }

  toStorageFormat() {
    return {
      id: this.id,
      timestamp: this.timestamp.iso,
      sender: this.sender,
      text: this.text,
      matchedKeywords: this.matchedKeywords,
      groupId: this.groupId,
      groupName: this.groupName,
      messageLength: this.messageLength,
      processed_at: new Date().toISOString()
    };
  }

  toNotificationFormat() {
    return {
      id: this.id,
      groupName: this.groupName,
      sender: this.sender,
      text: this.text,
      timestamp: this.timestamp,
      matchedKeywords: this.matchedKeywords,
      messageLength: this.messageLength
    };
  }

  // Static methods
  static validate(data) {
    try {
      return messageSchema.parse(data);
    } catch (error) {
      throw new Error(`Message validation failed: ${error.message}`);
    }
  }

  static validateProcessed(data) {
    try {
      return processedMessageSchema.parse(data);
    } catch (error) {
      throw new Error(`Processed message validation failed: ${error.message}`);
    }
  }

  static validateSummary(data) {
    try {
      return messageSummarySchema.parse(data);
    } catch (error) {
      throw new Error(`Message summary validation failed: ${error.message}`);
    }
  }

  static fromWhatsAppMessage(whatsappMessage, groupName, messageText, matchedKeywords = []) {
    const timestamp = {
      unix: whatsappMessage.messageTimestamp || Math.floor(Date.now() / 1000),
      iso: new Date((whatsappMessage.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      time: new Date((whatsappMessage.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000).toLocaleTimeString('pt-BR'),
      date: new Date((whatsappMessage.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000).toLocaleDateString('pt-BR')
    };

    return new MessageModel({
      id: whatsappMessage.key.id,
      groupId: whatsappMessage.key.remoteJid,
      groupName: groupName,
      sender: whatsappMessage.pushName || 'Desconhecido',
      text: messageText,
      timestamp: timestamp,
      matchedKeywords: matchedKeywords,
      isRelevant: matchedKeywords.length > 0,
      raw: whatsappMessage
    });
  }

  // Helper methods for analysis
  getWordCount() {
    return this.text.trim().split(/\s+/).length;
  }

  getCharacterCount() {
    return this.text.length;
  }

  hasKeyword(keyword) {
    const searchText = this.text.toLowerCase();
    const searchKeyword = keyword.toLowerCase();
    return searchText.includes(searchKeyword);
  }

  getKeywordPositions(keyword) {
    const positions = [];
    const searchText = this.text.toLowerCase();
    const searchKeyword = keyword.toLowerCase();
    
    let index = searchText.indexOf(searchKeyword);
    while (index !== -1) {
      positions.push(index);
      index = searchText.indexOf(searchKeyword, index + 1);
    }
    
    return positions;
  }

  getKeywordContext(keyword, contextLength = 50) {
    const positions = this.getKeywordPositions(keyword);
    const contexts = [];
    
    for (const position of positions) {
      const start = Math.max(0, position - contextLength);
      const end = Math.min(this.text.length, position + keyword.length + contextLength);
      contexts.push(this.text.substring(start, end));
    }
    
    return contexts;
  }

  // Comparison methods
  isSameGroup(other) {
    return this.groupId === other.groupId;
  }

  isSameSender(other) {
    return this.sender === other.sender;
  }

  isFromSameDay(other) {
    return this.timestamp.date === other.timestamp.date;
  }

  // Time-based methods
  getAge() {
    const now = new Date();
    const messageTime = new Date(this.timestamp.iso);
    return now - messageTime; // milliseconds
  }

  isFromToday() {
    const today = new Date().toLocaleDateString('pt-BR');
    return this.timestamp.date === today;
  }

  getHour() {
    return new Date(this.timestamp.iso).getHours();
  }

  // Classification methods
  isLongMessage(threshold = 200) {
    return this.messageLength > threshold;
  }

  hasMultipleKeywords() {
    return this.matchedKeywords.length > 1;
  }

  getRelevanceScore() {
    let score = 0;
    
    // Base score for being relevant
    if (this.isRelevant) score += 10;
    
    // Additional points for multiple keywords
    score += this.matchedKeywords.length * 5;
    
    // Bonus for longer messages (more context)
    if (this.messageLength > 100) score += 2;
    if (this.messageLength > 300) score += 3;
    
    return score;
  }
}

module.exports = {
  MessageModel,
  messageSchema,
  processedMessageSchema,
  messageSummarySchema
};