const sinon = require('sinon');

/**
 * Factory functions to create consistent mocks for testing
 */

// Mock Baileys (WhatsApp) Socket
function createMockWASocket() {
  const mockSocket = {
    // Connection methods
    ev: {
      on: sinon.stub(),
      off: sinon.stub(),
      emit: sinon.stub()
    },
    
    // Socket methods
    logout: sinon.stub().resolves(),
    end: sinon.stub().resolves(),
    
    // Group methods
    groupFetchAllParticipating: sinon.stub().resolves({}),
    groupMetadata: sinon.stub().resolves({}),
    
    // Message methods
    sendMessage: sinon.stub().resolves({ key: { id: 'test_message_id' } }),
    
    // Connection state
    user: {
      id: 'test_user_id',
      name: 'Test User'
    },
    
    // Store (if enabled)
    store: {
      loadMessages: sinon.stub().resolves([])
    }
  };
  
  return mockSocket;
}

// Mock Telegram Bot API
function createMockTelegramBot() {
  return {
    sendMessage: sinon.stub().resolves({ message_id: 123 }),
    sendPhoto: sinon.stub().resolves({ message_id: 124 }),
    sendDocument: sinon.stub().resolves({ message_id: 125 }),
    getMe: sinon.stub().resolves({ id: 123456, username: 'test_bot' }),
    setWebHook: sinon.stub().resolves(true),
    deleteWebHook: sinon.stub().resolves(true)
  };
}

// Mock File System operations
function createMockFS() {
  return {
    readFile: sinon.stub(),
    writeFile: sinon.stub().resolves(),
    mkdir: sinon.stub().resolves(),
    access: sinon.stub(),
    rm: sinon.stub().resolves(),
    stat: sinon.stub()
  };
}

// Mock Winston Logger
function createMockLogger() {
  return {
    info: sinon.stub(),
    error: sinon.stub(),
    warn: sinon.stub(),
    debug: sinon.stub(),
    startup: sinon.stub(),
    shutdown: sinon.stub(),
    connection: sinon.stub(),
    logError: sinon.stub()
  };
}

// Mock ConfigService
function createMockConfigService(config = {}) {
  const defaultConfig = {
    comunidade: 'Test Community',
    subgrupos: ['Test Group 1', 'Test Group 2'],
    palavras_chave: ['test', 'keyword', 'important'],
    case_sensitive: false,
    rate_limit: 60,
    notification_enabled: true,
    telegram_enabled: true,
    file_storage_enabled: true,
    log_retention_days: 30
  };
  
  const mockConfig = { ...defaultConfig, ...config };
  
  return {
    loadConfig: sinon.stub().resolves(mockConfig),
    saveConfig: sinon.stub().resolves(mockConfig),
    getConfig: sinon.stub().returns(mockConfig),
    validateConfig: sinon.stub().returns(mockConfig),
    configExists: sinon.stub().resolves(true),
    reloadConfig: sinon.stub().resolves(mockConfig),
    isTargetGroup: sinon.stub().returns(true),
    matchesKeywords: sinon.stub().returns(true),
    getMatchedKeywords: sinon.stub().returns(['test']),
    config: mockConfig
  };
}

// Mock WhatsApp Message
function createMockWhatsAppMessage(overrides = {}) {
  return {
    key: {
      id: 'test_message_123',
      remoteJid: 'test_group_123@g.us',
      fromMe: false,
      ...overrides.key
    },
    message: {
      conversation: 'Test message with keyword',
      ...overrides.message
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Test User',
    ...overrides
  };
}

// Mock Group Data
function createMockGroupData(overrides = {}) {
  return {
    id: 'test_group_123@g.us',
    subject: 'Test Group',
    participants: [
      { id: 'user1@s.whatsapp.net', admin: null },
      { id: 'user2@s.whatsapp.net', admin: 'admin' }
    ],
    creation: Date.now(),
    owner: 'user2@s.whatsapp.net',
    desc: 'Test group description',
    ...overrides
  };
}

// Mock PM2 Process
function createMockPM2Process() {
  return {
    pm_id: 0,
    name: 'milesguard',
    status: 'online',
    restart_time: 0,
    uptime: Date.now(),
    memory: 50000000, // 50MB
    cpu: 1.5,
    pid: 12345,
    pm2_env: {
      status: 'online',
      restart_time: 0,
      unstable_restarts: 0,
      created_at: Date.now(),
      pm_uptime: Date.now()
    }
  };
}

// Mock EventEmitter
function createMockEventEmitter() {
  const events = new Map();
  
  return {
    on: sinon.stub().callsFake((event, callback) => {
      if (!events.has(event)) {
        events.set(event, []);
      }
      events.get(event).push(callback);
    }),
    
    off: sinon.stub().callsFake((event, callback) => {
      if (events.has(event)) {
        const callbacks = events.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }),
    
    emit: sinon.stub().callsFake((event, ...args) => {
      if (events.has(event)) {
        events.get(event).forEach(callback => {
          callback(...args);
        });
      }
    }),
    
    removeAllListeners: sinon.stub().callsFake((event) => {
      if (event) {
        events.delete(event);
      } else {
        events.clear();
      }
    }),
    
    // Helper to get registered events (for testing)
    _getEvents: () => events
  };
}

module.exports = {
  createMockWASocket,
  createMockTelegramBot,
  createMockFS,
  createMockLogger,
  createMockConfigService,
  createMockWhatsAppMessage,
  createMockGroupData,
  createMockPM2Process,
  createMockEventEmitter
};