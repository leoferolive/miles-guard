// Helper functions extracted from poc-functions.js and enhanced

function getMessageText(message) {
  if (!message || !message.message) return null;

  const messageContent = message.message;

  // Extract text from different message types
  if (messageContent.conversation) {
    return messageContent.conversation;
  }

  if (messageContent.extendedTextMessage && messageContent.extendedTextMessage.text) {
    return messageContent.extendedTextMessage.text;
  }

  if (messageContent.imageMessage && messageContent.imageMessage.caption) {
    return messageContent.imageMessage.caption;
  }

  if (messageContent.videoMessage && messageContent.videoMessage.caption) {
    return messageContent.videoMessage.caption;
  }

  if (messageContent.documentMessage && messageContent.documentMessage.caption) {
    return messageContent.documentMessage.caption;
  }

  // Handle quoted messages
  if (messageContent.quotedMessage) {
    return getMessageText({ message: messageContent.quotedMessage });
  }

  return null;
}

function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .trim();
}

function isSystemMessage(message) {
  if (!message || !message.message) return true;
  
  const messageContent = message.message;
  
  // Check for system message types
  if (messageContent.protocolMessage) return true;
  if (messageContent.senderKeyDistributionMessage) return true;
  if (messageContent.messageContextInfo) return true;
  
  // Check if message has no text content
  const text = getMessageText(message);
  return !text || text.trim().length === 0;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return {
    time: date.toLocaleTimeString('pt-BR'),
    date: date.toLocaleDateString('pt-BR'),
    iso: date.toISOString(),
    unix: timestamp
  };
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createExponentialBackoff(baseDelay, maxDelay, maxAttempts) {
  return function(attempt) {
    if (attempt >= maxAttempts) return null;
    return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  };
}

function isValidGroupId(groupId) {
  return groupId && typeof groupId === 'string' && groupId.includes('@g.us');
}

function extractGroupName(group) {
  return group?.subject || 'Grupo Desconhecido';
}

function extractSenderName(message) {
  return message?.pushName || message?.key?.participant?.split('@')[0] || 'Desconhecido';
}

function createMessageFingerprint(message) {
  const text = getMessageText(message);
  const sender = extractSenderName(message);
  const timestamp = message.messageTimestamp;
  
  if (!text) return null;
  
  // Create a simple hash-like fingerprint
  const content = `${sender}-${text.substring(0, 100)}-${Math.floor(timestamp / 60)}`; // Group by minute
  return Buffer.from(content).toString('base64').substring(0, 16);
}

function validateEnvVariables(requiredVars) {
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
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
};