const path = require('path');
const fs = require('fs').promises;
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

// Configure Chai to use sinon-chai
chai.use(sinonChai);
const { expect } = chai;

// Load test environment variables
require('dotenv').config({ path: '.env.test' });

// Global test configuration
const TEST_CONFIG = {
  timeout: 10000,
  testDataPath: path.join(__dirname, '../fixtures'),
  tempPath: path.join(__dirname, '../../temp_test_data'),
  authPath: './test_auth_info',
  logsPath: './test_logs'
};

// Setup global test environment immediately
global.expect = expect;
global.sinon = sinon;
global.TEST_CONFIG = TEST_CONFIG;

// Utility functions
async function ensureTestDirectories() {
  const directories = [
    TEST_CONFIG.tempPath,
    TEST_CONFIG.authPath,
    TEST_CONFIG.logsPath,
    path.join(TEST_CONFIG.logsPath, '2024-01-01'),
    path.join(TEST_CONFIG.tempPath, 'configs'),
    path.join(TEST_CONFIG.tempPath, 'messages')
  ];
  
  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        console.warn(`Warning: Could not create test directory ${dir}:`, error.message);
      }
    }
  }
}

async function cleanupTestDirectories() {
  const directories = [
    TEST_CONFIG.tempPath,
    TEST_CONFIG.authPath,
    TEST_CONFIG.logsPath,
    './coverage/.nyc_output'
  ];
  
  for (const dir of directories) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn(`Warning: Could not clean test directory ${dir}:`, error.message);
    }
  }
}

// Export test utilities
module.exports = {
  TEST_CONFIG,
  ensureTestDirectories,
  cleanupTestDirectories,
  
  // Test helper functions
  createTestConfig: (overrides = {}) => ({
    comunidade: 'Test Community',
    subgrupos: ['Test Group 1', 'Test Group 2'],
    palavras_chave: ['test', 'keyword'],
    case_sensitive: false,
    rate_limit: 60,
    notification_enabled: true,
    telegram_enabled: false,
    file_storage_enabled: true,
    log_retention_days: 7,
    ...overrides
  }),
  
  createTestMessage: (overrides = {}) => ({
    id: 'test_message_123',
    groupId: 'test_group_123@g.us',
    groupName: 'Test Group',
    sender: 'Test User',
    text: 'This is a test message with keyword',
    timestamp: Date.now(),
    matchedKeywords: ['test'],
    isRelevant: true,
    ...overrides
  }),
  
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock console methods to avoid test output noise
  mockConsole: () => {
    sinon.stub(console, 'log');
    sinon.stub(console, 'info');
    sinon.stub(console, 'warn');
    sinon.stub(console, 'error');
  },
  
  // Restore console methods
  restoreConsole: () => {
    if (console.log.restore) console.log.restore();
    if (console.info.restore) console.info.restore();
    if (console.warn.restore) console.warn.restore();
    if (console.error.restore) console.error.restore();
  }
};