const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');

const ConfigService = require('../../../src/services/config.service');
const mockConfigs = require('../../fixtures/mock-configs');
const { cleanupUtils } = require('../../helpers/cleanup');

describe('ConfigService', () => {
  let configService;
  let fsStub;
  const testConfigPath = './test_config.json';

  beforeEach(() => {
    configService = new ConfigService();
    configService.configPath = testConfigPath;
    
    // Stub fs methods
    fsStub = {
      readFile: sinon.stub(fs, 'readFile'),
      writeFile: sinon.stub(fs, 'writeFile'),
      access: sinon.stub(fs, 'access')
    };
  });

  afterEach(async () => {
    sinon.restore();
    await cleanupUtils.cleanupConfigs([testConfigPath]);
  });

  describe('Constructor', () => {
    it('should initialize with default values', () => {
      expect(configService.config).to.be.null;
      expect(configService.configPath).to.equal(testConfigPath);
      expect(configService.schema).to.exist;
    });

    it('should use custom config path', () => {
      const customService = new ConfigService();
      customService.configPath = './custom_config.json';
      expect(customService.configPath).to.equal('./custom_config.json');
    });
  });

  describe('configExists()', () => {
    it('should return true when config file exists', async () => {
      fsStub.access.resolves();
      
      const exists = await configService.configExists();
      
      expect(exists).to.be.true;
      expect(fsStub.access.calledOnceWith(testConfigPath)).to.be.true;
    });

    it('should return false when config file does not exist', async () => {
      fsStub.access.rejects(new Error('ENOENT: no such file'));
      
      const exists = await configService.configExists();
      
      expect(exists).to.be.false;
      expect(fsStub.access.calledOnceWith(testConfigPath)).to.be.true;
    });
  });

  describe('loadConfig()', () => {
    it('should load valid configuration successfully', async () => {
      const mockConfig = mockConfigs.basicConfig;
      fsStub.access.resolves();
      fsStub.readFile.resolves(JSON.stringify(mockConfig));
      
      const result = await configService.loadConfig();
      
      expect(result).to.deep.equal(mockConfig);
      expect(configService.config).to.deep.equal(mockConfig);
      expect(fsStub.readFile.calledOnceWith(testConfigPath, 'utf8')).to.be.true;
    });

    it('should throw error when config file does not exist', async () => {
      fsStub.access.rejects(new Error('ENOENT'));
      
      try {
        await configService.loadConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Arquivo de configuração não encontrado');
      }
    });

    it('should throw error for invalid JSON', async () => {
      fsStub.access.resolves();
      fsStub.readFile.resolves('invalid json content');
      
      try {
        await configService.loadConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Unexpected token');
      }
    });

    it('should throw validation error for invalid config', async () => {
      fsStub.access.resolves();
      fsStub.readFile.resolves(JSON.stringify(mockConfigs.missingComunidadeConfig));
      
      try {
        await configService.loadConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração inválida');
        expect(error.message).to.include('comunidade');
      }
    });

    it('should handle minimal valid configuration', async () => {
      const mockConfig = mockConfigs.minimalConfig;
      fsStub.access.resolves();
      fsStub.readFile.resolves(JSON.stringify(mockConfig));
      
      const result = await configService.loadConfig();
      
      // Should include default values
      expect(result.case_sensitive).to.equal(false);
      expect(result.rate_limit).to.equal(60);
      expect(result.notification_enabled).to.equal(true);
    });
  });

  describe('saveConfig()', () => {
    it('should save valid configuration successfully', async () => {
      const mockConfig = mockConfigs.basicConfig;
      fsStub.writeFile.resolves();
      
      const result = await configService.saveConfig(mockConfig);
      
      expect(result).to.deep.equal(mockConfig);
      expect(configService.config).to.deep.equal(mockConfig);
      expect(fsStub.writeFile.calledOnceWith(
        testConfigPath,
        JSON.stringify(mockConfig, null, 2),
        'utf8'
      )).to.be.true;
    });

    it('should throw validation error for invalid config', async () => {
      try {
        await configService.saveConfig(mockConfigs.invalidTypesConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração inválida');
      }
    });

    it('should throw error for empty subgroups', async () => {
      try {
        await configService.saveConfig(mockConfigs.emptySubgruposConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração inválida');
        expect(error.message).to.include('subgrupos');
      }
    });

    it('should throw error for empty keywords', async () => {
      try {
        await configService.saveConfig(mockConfigs.emptyPalavrasChaveConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração inválida');
        expect(error.message).to.include('palavras_chave');
      }
    });

    it('should apply default values to incomplete config', async () => {
      const incompleteConfig = mockConfigs.minimalConfig;
      fsStub.writeFile.resolves();
      
      const result = await configService.saveConfig(incompleteConfig);
      
      expect(result.case_sensitive).to.equal(false);
      expect(result.rate_limit).to.equal(60);
      expect(result.notification_enabled).to.equal(true);
    });
  });

  describe('getConfig()', () => {
    it('should return loaded configuration', async () => {
      const mockConfig = mockConfigs.basicConfig;
      configService.config = mockConfig;
      
      const result = configService.getConfig();
      
      expect(result).to.deep.equal(mockConfig);
    });

    it('should throw error when config not loaded', () => {
      configService.config = null;
      
      try {
        configService.getConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração não foi carregada');
      }
    });
  });

  describe('reloadConfig()', () => {
    it('should reload configuration from file', async () => {
      const mockConfig = mockConfigs.basicConfig;
      fsStub.access.resolves();
      fsStub.readFile.resolves(JSON.stringify(mockConfig));
      
      const result = await configService.reloadConfig();
      
      expect(result).to.deep.equal(mockConfig);
      expect(configService.config).to.deep.equal(mockConfig);
    });
  });

  describe('validateConfig()', () => {
    it('should validate and return valid config', () => {
      const mockConfig = mockConfigs.basicConfig;
      
      const result = configService.validateConfig(mockConfig);
      
      expect(result).to.deep.equal(mockConfig);
    });

    it('should throw error for invalid config', () => {
      try {
        configService.validateConfig(mockConfigs.invalidTypesConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração inválida');
      }
    });

    it('should handle out of range values', () => {
      try {
        configService.validateConfig(mockConfigs.outOfRangeConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Configuração inválida');
      }
    });
  });

  describe('isTargetGroup()', () => {
    beforeEach(() => {
      configService.config = mockConfigs.basicConfig;
    });

    it('should return true for exact match', () => {
      const result = configService.isTargetGroup('Passagens SUL');
      expect(result).to.be.true;
    });

    it('should return true for partial match (group contains subgroup)', () => {
      const result = configService.isTargetGroup('Grupo Passagens SUL Oficial');
      expect(result).to.be.true;
    });

    it('should return true for partial match (subgroup contains group)', () => {
      const result = configService.isTargetGroup('SUL');
      expect(result).to.be.true;
    });

    it('should be case insensitive', () => {
      const result = configService.isTargetGroup('passagens sul');
      expect(result).to.be.true;
    });

    it('should return false for non-matching group', () => {
      const result = configService.isTargetGroup('Grupo Irrelevante');
      expect(result).to.be.false;
    });

    it('should return false when config not loaded', () => {
      configService.config = null;
      const result = configService.isTargetGroup('Passagens SUL');
      expect(result).to.be.false;
    });

    it('should handle empty group name', () => {
      const result = configService.isTargetGroup('');
      expect(result).to.be.false;
    });

    it('should handle null group name', () => {
      const result = configService.isTargetGroup(null);
      expect(result).to.be.false;
    });
  });

  describe('matchesKeywords()', () => {
    beforeEach(() => {
      configService.config = mockConfigs.basicConfig;
    });

    it('should return true for exact keyword match', () => {
      const result = configService.matchesKeywords('Oferta com 100% de bônus!');
      expect(result).to.be.true;
    });

    it('should return true for multiple keyword matches', () => {
      const result = configService.matchesKeywords('100% bônus na LATAM com Smiles!');
      expect(result).to.be.true;
    });

    it('should be case insensitive by default', () => {
      const result = configService.matchesKeywords('BONUS de 100%');
      expect(result).to.be.true;
    });

    it('should respect case sensitivity setting', () => {
      configService.config = mockConfigs.caseSensitiveConfig;
      
      const resultMatch = configService.matchesKeywords('BONUS na LATAM');
      const resultNoMatch = configService.matchesKeywords('bonus na latam');
      
      expect(resultMatch).to.be.true;
      expect(resultNoMatch).to.be.false;
    });

    it('should return false for non-matching text', () => {
      const result = configService.matchesKeywords('Mensagem sem palavras relevantes');
      expect(result).to.be.false;
    });

    it('should return false when config not loaded', () => {
      configService.config = null;
      const result = configService.matchesKeywords('100% bônus');
      expect(result).to.be.false;
    });

    it('should handle empty text', () => {
      const result = configService.matchesKeywords('');
      expect(result).to.be.false;
    });

    it('should handle null text', () => {
      const result = configService.matchesKeywords(null);
      expect(result).to.be.false;
    });
  });

  describe('getMatchedKeywords()', () => {
    beforeEach(() => {
      configService.config = mockConfigs.basicConfig;
    });

    it('should return matched keywords for single match', () => {
      const result = configService.getMatchedKeywords('Oferta com 100% de desconto!');
      expect(result).to.deep.equal(['100%']);
    });

    it('should return all matched keywords for multiple matches', () => {
      const result = configService.getMatchedKeywords('100% bônus na LATAM com Smiles!');
      expect(result).to.deep.equal(['100%', 'bônus', 'latam', 'smiles']);
    });

    it('should be case insensitive by default', () => {
      const result = configService.getMatchedKeywords('BONUS de 100% na LATAM');
      expect(result).to.deep.equal(['100%', 'bônus', 'latam']);
    });

    it('should respect case sensitivity setting', () => {
      configService.config = mockConfigs.caseSensitiveConfig;
      
      const result = configService.getMatchedKeywords('BONUS na latam');
      expect(result).to.deep.equal(['BONUS', 'latam']);
    });

    it('should return empty array for non-matching text', () => {
      const result = configService.getMatchedKeywords('Mensagem sem palavras relevantes');
      expect(result).to.deep.equal([]);
    });

    it('should return empty array when config not loaded', () => {
      configService.config = null;
      const result = configService.getMatchedKeywords('100% bônus');
      expect(result).to.deep.equal([]);
    });

    it('should handle empty text', () => {
      const result = configService.getMatchedKeywords('');
      expect(result).to.deep.equal([]);
    });

    it('should handle null text', () => {
      const result = configService.getMatchedKeywords(null);
      expect(result).to.deep.equal([]);
    });

    it('should not duplicate keywords', () => {
      const result = configService.getMatchedKeywords('100% bônus e mais 100% bônus!');
      expect(result).to.deep.equal(['100%', 'bônus']);
    });
  });

  describe('Integration with different config types', () => {
    it('should work with minimal configuration', async () => {
      const mockConfig = mockConfigs.minimalConfig;
      configService.config = mockConfig;
      
      expect(configService.isTargetGroup('Test Group')).to.be.true;
      expect(configService.matchesKeywords('test message')).to.be.true;
      expect(configService.getMatchedKeywords('test message')).to.deep.equal(['test']);
    });

    it('should work with many keywords configuration', async () => {
      const mockConfig = mockConfigs.manyKeywordsConfig;
      configService.config = mockConfig;
      
      const result = configService.getMatchedKeywords('Promoção de milhas com 100% bônus!');
      expect(result).to.include.members(['promoção', 'milhas', '100%', 'bônus']);
    });

    it('should work with many subgroups configuration', async () => {
      const mockConfig = mockConfigs.manySubgroupsConfig;
      configService.config = mockConfig;
      
      expect(configService.isTargetGroup('Passagens NORTE')).to.be.true;
      expect(configService.isTargetGroup('Transferências Azul')).to.be.true;
      expect(configService.isTargetGroup('Grupo Inexistente')).to.be.false;
    });
  });

  describe('Error handling', () => {
    it('should handle file system errors gracefully', async () => {
      fsStub.access.resolves();
      fsStub.readFile.rejects(new Error('Permission denied'));
      
      try {
        await configService.loadConfig();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Permission denied');
      }
    });

    it('should handle write errors gracefully', async () => {
      const mockConfig = mockConfigs.basicConfig;
      fsStub.writeFile.rejects(new Error('Disk full'));
      
      try {
        await configService.saveConfig(mockConfig);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Disk full');
      }
    });
  });
});