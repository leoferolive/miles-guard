/**
 * Mock configurations for testing different scenarios
 */

// Basic valid configuration
const basicConfig = {
  comunidade: 'M01 Comunidade Masters',
  subgrupos: [
    'Passagens SUL',
    'Compra de Pontos',
    'Transferências'
  ],
  palavras_chave: [
    '100%',
    'bônus',
    'latam',
    'smiles'
  ],
  case_sensitive: false,
  rate_limit: 60,
  notification_enabled: true,
  telegram_enabled: true,
  file_storage_enabled: true,
  log_retention_days: 30
};

// Minimal valid configuration
const minimalConfig = {
  comunidade: 'Test Community',
  subgrupos: ['Test Group'],
  palavras_chave: ['test']
};

// Configuration with case sensitivity
const caseSensitiveConfig = {
  ...basicConfig,
  case_sensitive: true,
  palavras_chave: ['BONUS', 'Smiles', 'latam', '100%']
};

// Configuration with notifications disabled
const noNotificationsConfig = {
  ...basicConfig,
  notification_enabled: false,
  telegram_enabled: false,
  file_storage_enabled: false
};

// Configuration with only Telegram enabled
const telegramOnlyConfig = {
  ...basicConfig,
  telegram_enabled: true,
  file_storage_enabled: false
};

// Configuration with only file storage enabled
const fileStorageOnlyConfig = {
  ...basicConfig,
  telegram_enabled: false,
  file_storage_enabled: true
};

// Configuration with many keywords
const manyKeywordsConfig = {
  ...basicConfig,
  palavras_chave: [
    '100%', 'bônus', 'bonus', 'latam', 'smiles', 'azul', 'gol',
    'promoção', 'oferta', 'desconto', 'milhas', 'pontos',
    'transferência', 'compra', 'venda', 'troca'
  ]
};

// Configuration with many subgroups
const manySubgroupsConfig = {
  ...basicConfig,
  subgrupos: [
    'Passagens SUL',
    'Passagens NORTE',
    'Passagens NORDESTE',
    'Compra de Pontos',
    'Venda de Pontos',
    'Transferências Smiles',
    'Transferências Latam',
    'Transferências Azul',
    'Promoções Cartão',
    'Ofertas Especiais'
  ]
};

// Configuration with aggressive rate limiting
const aggressiveRateLimitConfig = {
  ...basicConfig,
  rate_limit: 10
};

// Configuration with relaxed rate limiting
const relaxedRateLimitConfig = {
  ...basicConfig,
  rate_limit: 300
};

// Configuration with short log retention
const shortRetentionConfig = {
  ...basicConfig,
  log_retention_days: 1
};

// Configuration with long log retention
const longRetentionConfig = {
  ...basicConfig,
  log_retention_days: 365
};

// Invalid configurations for testing validation

// Missing required fields
const missingComunidadeConfig = {
  subgrupos: ['Test Group'],
  palavras_chave: ['test']
};

const missingSubgruposConfig = {
  comunidade: 'Test Community',
  palavras_chave: ['test']
};

const missingPalavrasChaveConfig = {
  comunidade: 'Test Community',
  subgrupos: ['Test Group']
};

// Empty arrays
const emptySubgruposConfig = {
  comunidade: 'Test Community',
  subgrupos: [],
  palavras_chave: ['test']
};

const emptyPalavrasChaveConfig = {
  comunidade: 'Test Community',
  subgrupos: ['Test Group'],
  palavras_chave: []
};

// Invalid types
const invalidTypesConfig = {
  comunidade: 123,
  subgrupos: 'not an array',
  palavras_chave: { not: 'an array' },
  case_sensitive: 'not a boolean',
  rate_limit: 'not a number'
};

// Out of range values
const outOfRangeConfig = {
  ...basicConfig,
  rate_limit: 500, // Max is 300
  log_retention_days: 400 // Max is 365
};

// Export all configurations
module.exports = {
  // Valid configurations
  basicConfig,
  minimalConfig,
  caseSensitiveConfig,
  noNotificationsConfig,
  telegramOnlyConfig,
  fileStorageOnlyConfig,
  manyKeywordsConfig,
  manySubgroupsConfig,
  aggressiveRateLimitConfig,
  relaxedRateLimitConfig,
  shortRetentionConfig,
  longRetentionConfig,
  
  // Invalid configurations
  missingComunidadeConfig,
  missingSubgruposConfig,
  missingPalavrasChaveConfig,
  emptySubgruposConfig,
  emptyPalavrasChaveConfig,
  invalidTypesConfig,
  outOfRangeConfig,
  
  // Helper functions
  getValidConfigs: () => [
    basicConfig,
    minimalConfig,
    caseSensitiveConfig,
    noNotificationsConfig,
    telegramOnlyConfig,
    fileStorageOnlyConfig,
    manyKeywordsConfig,
    manySubgroupsConfig,
    aggressiveRateLimitConfig,
    relaxedRateLimitConfig,
    shortRetentionConfig,
    longRetentionConfig
  ],
  
  getInvalidConfigs: () => [
    missingComunidadeConfig,
    missingSubgruposConfig,
    missingPalavrasChaveConfig,
    emptySubgruposConfig,
    emptyPalavrasChaveConfig,
    invalidTypesConfig,
    outOfRangeConfig
  ],
  
  createCustomConfig: (overrides = {}) => ({
    ...basicConfig,
    ...overrides
  })
};