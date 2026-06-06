const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const { z } = require('zod');
const { normalizeText } = require('../utils/helpers');

class InteractiveConfigService {
  constructor() {
    this.configPath = './config.json';
  }

  async runInteractiveSetup() {
    console.log('🔧 Configuração Interativa do MilesGuard');
    console.log('Bem-vindo ao assistente de configuração do MilesGuard!\n');

    // Perguntar se o usuário deseja usar notificações do Telegram
    const notificationChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useTelegram',
        message: 'Você gostaria de configurar notificações via Telegram?',
        default: true
      }
    ]);

    // Perguntar sobre armazenamento local
    const fileStorageChoice = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useFileStorage',
        message: 'Você gostaria de salvar as ofertas em arquivos locais?',
        default: true
      }
    ]);

    // Se o usuário optar por usar Telegram, verificar se já tem as credenciais
    let telegramConfig = {
      telegram_enabled: notificationChoice.useTelegram,
      file_storage_enabled: fileStorageChoice.useFileStorage
    };

    if (notificationChoice.useTelegram) {
      console.log('\nPara configurar o Telegram, você precisará de:');
      console.log('- Um bot token (obtido com o @BotFather no Telegram)');
      console.log('- Um chat ID (você pode obter isso após iniciar uma conversa com o bot)\n');

      const telegramAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'botToken',
          message: 'Digite seu Telegram Bot Token:',
          validate: (input) => {
            if (!input || input.trim() === '') {
              return 'O bot token é obrigatório para habilitar o Telegram';
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
              return 'O chat ID é obrigatório para habilitar o Telegram';
            }
            return true;
          }
        }
      ]);

      // Criar ou atualizar o arquivo .env com as configurações do Telegram
      await this.setupTelegramEnv(telegramAnswers.botToken, telegramAnswers.chatId);
    }

    // Configuração básica do sistema
    console.log('\nAgora vamos configurar os grupos e palavras-chave para monitoramento:\n');

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

    // Criar o objeto de configuração
    const config = {
      comunidade: basicConfig.comunidade,
      subgrupos: subgrupos,
      palavras_chave: palavrasChave,
      case_sensitive: false,
      rate_limit: 60,
      notification_enabled: notificationChoice.useTelegram || fileStorageChoice.useFileStorage,
      telegram_enabled: notificationChoice.useTelegram,
      file_storage_enabled: fileStorageChoice.useFileStorage,
      log_retention_days: 30
    };

    // Salvar a configuração
    await this.saveConfig(config);

    console.log('\n✅ Configuração concluída com sucesso!');
    console.log('Você pode modificar as configurações manualmente no arquivo config.json');
    
    if (notificationChoice.useTelegram) {
      console.log('Você também pode configurar o Telegram no arquivo .env');
    }

    return config;
  }

  async setupTelegramEnv(botToken, chatId) {
    const envPath = '.env';
    let envContent = '';

    // Ler o conteúdo atual do .env se existir
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch (error) {
      // Se não existir, criar um novo
      envContent = '# MilesGuard Environment Configuration\n\n';
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

    // Garantir que as variáveis obrigatórias estejam presentes
    if (!envContent.includes('NODE_ENV=')) {
      envContent += 'NODE_ENV=development\n';
    }

    // Salvar o arquivo .env
    await fs.writeFile(envPath, envContent, 'utf8');
  }

  async saveConfig(config) {
    const configJson = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, configJson, 'utf8');
  }

  async checkAndRunSetup() {
    // Verificar se o arquivo de configuração existe
    try {
      await fs.access(this.configPath);
      // Se existir, perguntar se deseja reconfigurar
      const { reconfigure } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'reconfigure',
          message: 'Arquivo de configuração já existe. Deseja reconfigurar?',
          default: false
        }
      ]);

      if (reconfigure) {
        return await this.runInteractiveSetup();
      } else {
        // Carregar configuração existente
        const configData = await fs.readFile(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      // Se não existir, executar a configuração
      return await this.runInteractiveSetup();
    }
  }
}

module.exports = InteractiveConfigService;