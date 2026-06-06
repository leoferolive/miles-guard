const fs = require('fs').promises;
const { z } = require('zod');
const { normalizeText } = require('../utils/helpers');

const configSchema = z.object({
  comunidade: z.string().min(1, 'Nome da comunidade é obrigatório'),
  subgrupos: z.array(z.string().min(1)).min(1, 'Pelo menos um subgrupo deve ser especificado'),
  palavras_chave: z.array(z.string().min(1)).min(1, 'Pelo menos uma palavra-chave deve ser especificada'),
  case_sensitive: z.boolean().default(false),
  rate_limit: z.number().int().min(1).max(300).default(60),
  notification_enabled: z.boolean().default(true),
  telegram_enabled: z.boolean().default(true),
  file_storage_enabled: z.boolean().default(true),
  log_retention_days: z.number().int().min(1).max(365).default(30)
});

class ConfigService {
  constructor() {
    this.config = null;
    this.configPath = './config.json';
    this.schema = configSchema;
  }

  async loadConfig() {
    try {
      const configExists = await this.configExists();
      if (!configExists) {
        throw new Error(`Arquivo de configuração não encontrado: ${this.configPath}`);
      }

      const configData = await fs.readFile(this.configPath, 'utf8');
      const rawConfig = JSON.parse(configData);
      
      this.config = this.schema.parse(rawConfig);
      return this.config;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues?.map(err => `${err.path.join('.')}: ${err.message}`) || [error.message || 'Invalid configuration'];
        throw new Error(`Configuração inválida:\n${errorMessages.join('\n')}`);
      }
      throw error;
    }
  }

  async saveConfig(config) {
    try {
      const validatedConfig = this.schema.parse(config);
      const configJson = JSON.stringify(validatedConfig, null, 2);
      
      await fs.writeFile(this.configPath, configJson, 'utf8');
      this.config = validatedConfig;
      
      return validatedConfig;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues?.map(err => `${err.path.join('.')}: ${err.message}`) || [error.message || 'Invalid configuration'];
        throw new Error(`Configuração inválida:\n${errorMessages.join('\n')}`);
      }
      throw error;
    }
  }

  async configExists() {
    try {
      await fs.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  getConfig() {
    if (!this.config) {
      throw new Error('Configuração não foi carregada. Execute loadConfig() primeiro.');
    }
    return this.config;
  }

  async reloadConfig() {
    return await this.loadConfig();
  }

  validateConfig(config) {
    try {
      return this.schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues?.map(err => `${err.path.join('.')}: ${err.message}`) || [error.message || 'Invalid configuration'];
        throw new Error(`Configuração inválida:\n${errorMessages.join('\n')}`);
      }
      throw new Error(`Configuração inválida: ${error.message}`);
    }
  }

  isTargetGroup(groupName) {
    if (!this.config || !groupName) return false;
    
    const normalizedGroupName = groupName.toLowerCase();
    return this.config.subgrupos.some(subgrupo => 
      normalizedGroupName.includes(subgrupo.toLowerCase()) ||
      subgrupo.toLowerCase().includes(normalizedGroupName)
    );
  }

  matchesKeywords(text) {
    if (!this.config || !text) return false;
    
    const searchText = this.config.case_sensitive ? text : normalizeText(text);
    
    return this.config.palavras_chave.some(keyword => {
      const searchKeyword = this.config.case_sensitive ? keyword : normalizeText(keyword);
      return searchText.includes(searchKeyword);
    });
  }

  getMatchedKeywords(text) {
    if (!this.config || !text) return [];
    
    const searchText = this.config.case_sensitive ? text : normalizeText(text);
    
    return this.config.palavras_chave.filter(keyword => {
      const searchKeyword = this.config.case_sensitive ? keyword : normalizeText(keyword);
      return searchText.includes(searchKeyword);
    });
  }
}

module.exports = ConfigService;