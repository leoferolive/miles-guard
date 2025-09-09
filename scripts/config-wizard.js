#!/usr/bin/env node

/**
 * MilesGuard Interactive Configuration Script
 * Interactive setup for Telegram and basic configuration
 */

const { Telegraf } = require('telegraf');
const fs = require('fs').promises;
const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title.toUpperCase(), 'cyan'));
  console.log('='.repeat(60));
}

function printSuccess(message) {
  console.log(`${colorize('✅', 'green')} ${message}`);
}

function printError(message) {
  console.log(`${colorize('❌', 'red')} ${message}`);
}

function printWarning(message) {
  console.log(`${colorize('⚠️ ', 'yellow')} ${message}`);
}

function printInfo(message) {
  console.log(`${colorize('ℹ️ ', 'blue')} ${message}`);
}

class MilesGuardConfigWizard {
  constructor() {
    this.configPath = './config.json';
    this.envPath = '.env';
  }

  async run() {
    printHeader('MilesGuard Configuration Wizard');
    
    console.log(colorize('Bem-vindo ao assistente de configuração do MilesGuard!', 'cyan'));
    console.log('Este assistente irá ajudá-lo a configurar o sistema para monitorar grupos do WhatsApp.\n');

    try {
      // Perguntar sobre notificações do Telegram
      await this.configureNotifications();
      
      // Configurar grupos e palavras-chave
      await this.configureBasicSettings();
      
      // Validar configuração
      await this.validateConfiguration();
      
      printHeader('Configuração Concluída');
      console.log(colorize('🎉 Configuração concluída com sucesso!', 'green'));
      console.log('\nAgora você pode iniciar o MilesGuard com:');
      console.log(colorize('  npm start', 'cyan'));
      console.log('ou');
      console.log(colorize('  npm run prod', 'cyan'), '(para modo produção com PM2)\n');
      
      console.log('O sistema irá gerar um QR Code para você conectar com o WhatsApp.');
      console.log('Após a conexão, começará a monitorar os grupos especificados.');
      
    } catch (error) {
      printError(`Erro durante a configuração: ${error.message}`);
      process.exit(1);
    }
  }

  async configureNotifications() {
    printHeader('Configuração de Notificações');
    
    console.log('O MilesGuard pode enviar notificações de duas formas:');
    console.log('1. Via Telegram (recomendado) - notificações em tempo real');
    console.log('2. Arquivos locais - salva as ofertas em arquivos organizados por data\n');
    
    const notificationChoices = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'notifications',
        message: 'Como você gostaria de receber notificações?',
        choices: [
          { name: 'Telegram (notificações em tempo real)', value: 'telegram' },
          { name: 'Arquivos locais (salvar em pastas organizadas)', value: 'files' }
        ],
        validate: (input) => {
          if (input.length === 0) {
            return 'Você deve escolher pelo menos um método de notificação';
          }
          return true;
        }
      }
    ]);
    
    const useTelegram = notificationChoices.notifications.includes('telegram');
    const useFiles = notificationChoices.notifications.includes('files');
    
    // Configurar Telegram se selecionado
    if (useTelegram) {
      await this.setupTelegram();
    }
    
    // Atualizar configuração
    await this.updateConfigNotifications(useTelegram, useFiles);
  }

  async setupTelegram() {
    printHeader('Configuração do Telegram');
    
    console.log('Para configurar o Telegram, você precisará de:');
    console.log('- Um bot token (obtido com o @BotFather no Telegram)');
    console.log('- Um chat ID (você pode obter isso após iniciar uma conversa com o bot)\n');
    
    const telegramConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'botToken',
        message: 'Digite seu Telegram Bot Token:',
        validate: (input) => {
          if (!input || input.trim() === '') {
            return 'O bot token é obrigatório';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'chatId',
        message: 'Digite seu Telegram Chat ID:',
        validate: (input) => {
          if (!input || input.trim() === '') {
            return 'O chat ID é obrigatório';
          }
          return true;
        }
      }
    ]);
    
    // Testar conexão com o Telegram
    printInfo('Testando conexão com o Telegram...');
    const testResult = await this.testTelegramConnection(telegramConfig.botToken);
    
    if (testResult.success) {
      printSuccess(`Conectado como: ${testResult.botName}`);
      await this.saveTelegramEnv(telegramConfig.botToken, telegramConfig.chatId);
      printSuccess('Configuração do Telegram salva com sucesso!');
    } else {
      printError('Falha ao conectar com o Telegram. Verifique suas credenciais.');
      printWarning('Você pode configurar o Telegram posteriormente editando o arquivo .env');
    }
  }

  async testTelegramConnection(botToken) {
    try {
      const bot = new Telegraf(botToken);
      const me = await bot.telegram.getMe();
      return { success: true, botName: me.username };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async saveTelegramEnv(botToken, chatId) {
    let envContent = '';
    
    // Ler o conteúdo atual do .env se existir
    try {
      envContent = await fs.readFile(this.envPath, 'utf8');
    } catch (error) {
      // Se não existir, criar um novo com variáveis básicas
      envContent = '# MilesGuard Environment Configuration\n\n';
      envContent += 'NODE_ENV=development\n';
      envContent += 'LOG_LEVEL=info\n';
      envContent += 'LOG_FILE=./logs/milesguard.log\n\n';
    }
    
    // Atualizar ou adicionar as variáveis do Telegram
    if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
      envContent = envContent.replace(
        /TELEGRAM_BOT_TOKEN=.*/g,
        `TELEGRAM_BOT_TOKEN=${botToken}`
      );
    } else {
      envContent += `TELEGRAM_BOT_TOKEN=${botToken}\n`;
    }
    
    if (envContent.includes('TELEGRAM_CHAT_ID=')) {
      envContent = envContent.replace(
        /TELEGRAM_CHAT_ID=.*/g,
        `TELEGRAM_CHAT_ID=${chatId}`
      );
    } else {
      envContent += `TELEGRAM_CHAT_ID=${chatId}\n`;
    }
    
    // Salvar o arquivo .env
    await fs.writeFile(this.envPath, envContent, 'utf8');
  }

  async updateConfigNotifications(useTelegram, useFiles) {
    let config = {};
    
    // Carregar configuração existente ou criar nova
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      // Configuração padrão se não existir
      config = {
        comunidade: "#01 Comunidade Masters ✈️",
        subgrupos: [
          "✈️ M01 - Passagens SUL",
          "✈️ M01 - Passagens SUDESTE",
          "♻️ M01 - Transferências Bonificadas"
        ],
        palavras_chave: [
          "100%",
          "bônus",
          "SMILES",
          "Destino: Curitiba"
        ],
        case_sensitive: false,
        rate_limit: 60,
        notification_enabled: true,
        telegram_enabled: useTelegram,
        file_storage_enabled: useFiles,
        log_retention_days: 30
      };
    }
    
    // Atualizar configuração de notificações
    config.notification_enabled = useTelegram || useFiles;
    config.telegram_enabled = useTelegram;
    config.file_storage_enabled = useFiles;
    
    // Salvar configuração
    const configJson = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, configJson, 'utf8');
  }

  async configureBasicSettings() {
    printHeader('Configuração Básica');
    
    console.log('Agora vamos configurar os grupos e palavras-chave para monitoramento:\n');
    
    const basicConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'comunidade',
        message: 'Nome da comunidade principal:',
        default: '#01 Comunidade Masters ✈️'
      },
      {
        type: 'input',
        name: 'subgrupos',
        message: 'Nomes dos subgrupos (separados por vírgula):',
        default: '✈️ M01 - Passagens SUL,✈️ M01 - Passagens SUDESTE,♻️ M01 - Transferências Bonificadas'
      },
      {
        type: 'input',
        name: 'palavrasChave',
        message: 'Palavras-chave para filtrar ofertas (separadas por vírgula):',
        default: '100%,bônus,SMILES,Destino: Curitiba'
      }
    ]);
    
    // Processar as entradas
    const subgrupos = basicConfig.subgrupos.split(',').map(s => s.trim());
    const palavrasChave = basicConfig.palavrasChave.split(',').map(p => p.trim());
    
    // Atualizar a configuração
    let config = {};
    
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      config = {};
    }
    
    config.comunidade = basicConfig.comunidade;
    config.subgrupos = subgrupos;
    config.palavras_chave = palavrasChave;
    
    // Garantir que as configurações de notificação estejam presentes
    if (config.telegram_enabled === undefined) config.telegram_enabled = false;
    if (config.file_storage_enabled === undefined) config.file_storage_enabled = true;
    if (config.notification_enabled === undefined) config.notification_enabled = true;
    if (config.case_sensitive === undefined) config.case_sensitive = false;
    if (config.rate_limit === undefined) config.rate_limit = 60;
    if (config.log_retention_days === undefined) config.log_retention_days = 30;
    
    // Salvar configuração
    const configJson = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, configJson, 'utf8');
    
    printSuccess('Configuração básica salva com sucesso!');
  }

  async validateConfiguration() {
    printHeader('Validação da Configuração');
    
    try {
      // Verificar se os arquivos de configuração existem
      await fs.access(this.configPath);
      printSuccess('Arquivo de configuração encontrado');
      
      // Verificar se os diretórios necessários existem
      const requiredDirs = ['logs', 'data', 'temp'];
      for (const dir of requiredDirs) {
        try {
          await fs.access(dir);
        } catch (error) {
          // Criar diretório se não existir
          await fs.mkdir(dir, { recursive: true });
          printInfo(`Diretório criado: ${dir}`);
        }
      }
      printSuccess('Diretórios necessários verificados');
      
      // Verificar configuração
      const configData = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (!config.comunidade || config.comunidade.trim() === '') {
        printWarning('Nome da comunidade não configurado');
      }
      
      if (!config.subgrupos || config.subgrupos.length === 0) {
        printWarning('Nenhum subgrupo configurado');
      }
      
      if (!config.palavras_chave || config.palavras_chave.length === 0) {
        printWarning('Nenhuma palavra-chave configurada');
      }
      
      printSuccess('Configuração validada com sucesso!');
      
    } catch (error) {
      printError(`Erro na validação: ${error.message}`);
      throw error;
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(colorize('MilesGuard Configuration Wizard', 'cyan'));
  console.log('\nUsage:');
  console.log('  npm run config     - Run interactive configuration wizard');
  console.log('  npm run config -h  - Show this help');
  console.log('\nThis script will help you configure:');
  console.log('  • Telegram notifications (optional)');
  console.log('  • WhatsApp groups to monitor');
  console.log('  • Keywords for filtering offers');
  console.log('  • Basic application settings');
  process.exit(0);
}

// Run configuration wizard
if (require.main === module) {
  const wizard = new MilesGuardConfigWizard();
  wizard.run().catch(console.error);
}

module.exports = MilesGuardConfigWizard;