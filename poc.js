const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk').default;
require('dotenv').config();
const { getMessageText } = require('./poc-functions');

// Estado da conexão
let sock;
let isConnected = false;
let groups = new Map();
let targetGroups = new Map(); // Grupos específicos que queremos monitorar
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function startPOC() {
  console.log(chalk.blue('🚀 MilesGuard POC - WhatsApp Connection Test\n'));
  
  try {
    // Configurar autenticação
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_poc');
    
    // Criar socket WhatsApp
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false // Vamos controlar o QR manualmente
      // Removido o logger para evitar erro de configuração
    });
    
    // Event: QR Code
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log(chalk.yellow('📱 QR Code gerado - Escaneie com seu WhatsApp:'));
        console.log(chalk.gray('   (O QR Code aparecerá abaixo)\n'));
        qrcode.generate(qr, { small: true });
        console.log(chalk.gray('\n⏳ Aguardando conexão...\n'));
      }
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        const isConflict = (lastDisconnect?.error)?.output?.payload?.message?.includes('conflict');
        
        console.log(chalk.red('❌ Conexão fechada:'), lastDisconnect?.error);
        
        // Se for um conflito (múltiplas sessões), limpar credenciais e reiniciar
        if (isConflict) {
          console.log(chalk.yellow('⚠️  Conflito de sessão detectado. Limpando credenciais e reiniciando...'));
          await clearAuthState();
          reconnectAttempts = 0;
          setTimeout(startPOC, 2000);
          return;
        }
        
        // Tentar reconectar com backoff exponencial
        if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000); // Máximo de 30 segundos
          console.log(chalk.yellow(`🔄 Tentando reconectar (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) em ${delay/1000} segundos...`));
          setTimeout(startPOC, delay);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(chalk.red('❌ Número máximo de tentativas de reconexão atingido. Encerrando...'));
          process.exit(1);
        }
      } else if (connection === 'open') {
        isConnected = true;
        reconnectAttempts = 0; // Resetar contador de tentativas
        console.log(chalk.bold.green('✅ Conectado ao WhatsApp com sucesso!\n'));
        
        // Aguardar um pouco e então buscar grupos
        setTimeout(fetchTargetGroups, 2000);
      }
    });
    
    // Event: Credenciais atualizadas
    sock.ev.on('creds.update', saveCreds);
    
    // Event: Mensagens recebidas
    sock.ev.on('messages.upsert', async (messageUpdate) => {
      const { messages } = messageUpdate;
      
      for (const message of messages) {
        if (message.key && message.key.remoteJid && message.message) {
          await handleNewMessage(message);
        }
      }
    });
    
    // Event: Grupos atualizados
    sock.ev.on('groups.update', (updates) => {
      for (const update of updates) {
        if (groups.has(update.id)) {
          const group = groups.get(update.id);
          console.log(chalk.blue('📝 Grupo atualizado:'), chalk.white(group.subject));
        }
      }
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Erro ao iniciar POC:'), error);
    // Tentar reconectar em caso de erro
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000);
      console.log(chalk.yellow(`🔄 Tentando reconectar (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) em ${delay/1000} segundos...`));
      setTimeout(startPOC, delay);
    }
  }
}

async function clearAuthState() {
  try {
    const fs = require('fs').promises;
    await fs.rm('./auth_info_poc', { recursive: true, force: true });
    await fs.mkdir('./auth_info_poc', { recursive: true });
    console.log(chalk.green('✅ Credenciais limpas com sucesso'));
  } catch (error) {
    console.error(chalk.red('❌ Erro ao limpar credenciais:'), error);
  }
}

async function fetchTargetGroups() {
  try {
    console.log(chalk.cyan('🔍 Buscando grupos específicos...\n'));
    
    const groupsData = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groupsData);
    
    groups.clear();
    targetGroups.clear();
    
    // Definir os grupos que queremos monitorar
    const targetGroupNames = [
      '#01 Comunidade Masters ✈️',
      '♻️ M01 - Transferências Bonificadas'
    ];
    
    console.log(chalk.bold.green(`📊 Grupos específicos encontrados:\n`));
    
    let foundGroups = [];
    
    groupList.forEach((group) => {
      groups.set(group.id, group);
      
      const groupName = group.subject;
      const participantCount = group.participants?.length || 0;
      
      // Verificar se é um dos grupos específicos que queremos
      const isTargetGroup = targetGroupNames.includes(groupName);
      
      if (isTargetGroup) {
        targetGroups.set(group.id, group);
        foundGroups.push(groupName);
        console.log(chalk.green(`🎯 ${groupName}`), chalk.gray(`(${participantCount} membros)`));
        
        // Buscar as últimas 5 mensagens com conteúdo "Smiles"
        fetchLastSmilesMessages(group.id, groupName);
      }
    });
    
    if (foundGroups.length > 0) {
      console.log('\n' + chalk.bold.green('✅ Grupos-alvo encontrados:'));
      foundGroups.forEach(group => {
        console.log(chalk.green(`   ✅ ${group}`));
      });
    } else {
      console.log(chalk.yellow('⚠️  Nenhum dos grupos específicos foi encontrado'));
      console.log(chalk.gray('   Verifique se você está nos grupos corretos'));
    }
    
    console.log('\n' + chalk.bold.cyan('👂 Monitorando mensagens em tempo real...'));
    console.log(chalk.gray('   (As mensagens aparecerão abaixo conforme chegarem)\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Erro ao buscar grupos:'), error);
    
    // Se o erro for de conexão fechada, tentar reconectar
    if (error.message && error.message.includes('Connection Closed')) {
      console.log(chalk.yellow('🔄 Tentando reconectar devido a erro de conexão...'));
      setTimeout(startPOC, 3000);
    }
  }
}

async function fetchLastSmilesMessages(groupId, groupName) {
  try {
    console.log(chalk.cyan(`\n🔍 Buscando últimas mensagens com "Smiles" em ${groupName}...`));
    
    // Verificar se o store está disponível
    if (!sock.store) {
      console.log(chalk.yellow('   ⚠️  Store não disponível para busca de mensagens antigas'));
      return;
    }
    
    // Carregar mensagens do grupo (tentando carregar um número razoável de mensagens)
    const messages = await sock.store.loadMessages(groupId, 50);
    
    // Filtrar as últimas 5 mensagens que contenham "Smiles"
    let smilesMessages = [];
    for (const msg of messages) {
      const messageText = getMessageText(msg);
      if (messageText && messageText.toLowerCase().includes('smiles')) {
        smilesMessages.push({
          text: messageText,
          sender: msg.pushName || 'Desconhecido',
          timestamp: new Date(msg.messageTimestamp * 1000).toLocaleString()
        });
        
        // Limitar a 5 mensagens
        if (smilesMessages.length >= 5) break;
      }
    }
    
    // Exibir as mensagens encontradas
    if (smilesMessages.length > 0) {
      console.log(chalk.bold.green(`\n📝 Últimas ${smilesMessages.length} mensagens com "Smiles" encontradas:`));
      smilesMessages.forEach((msg, index) => {
        console.log(chalk.white(`   ${index + 1}. [${msg.timestamp}] ${msg.sender}: "${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}"`));
      });
    } else {
      console.log(chalk.yellow('   ⚠️  Nenhuma mensagem com "Smiles" encontrada recentemente'));
    }
    
  } catch (error) {
    console.error(chalk.red(`❌ Erro ao buscar mensagens do grupo ${groupName}:`), error);
  }
}

async function handleNewMessage(message) {
  try {
    const groupId = message.key.remoteJid;
    const group = groups.get(groupId);
    
    if (!group) return; // Ignorar mensagens que não são de grupos
    
    const groupName = group.subject;
    const senderName = message.pushName || 'Desconhecido';
    const messageText = getMessageText(message);
    
    if (!messageText || messageText.length === 0) return; // Ignorar mensagens vazias/sistema
    
    const timestamp = new Date().toLocaleTimeString();
    
    // Verificar se é um dos grupos específicos que queremos monitorar
    const isTargetGroup = targetGroups.has(groupId);
    
    // Destacar mensagens dos grupos específicos
    if (isTargetGroup) {
      console.log(chalk.bold.green('\n🎯 MENSAGEM DE GRUPO ESPECÍFICO DETECTADA!'));
      console.log(chalk.green(`📱 Grupo: ${groupName}`));
      console.log(chalk.yellow(`👤 De: ${senderName}`));
      console.log(chalk.gray(`🕐 Hora: ${timestamp}`));
      console.log(chalk.white(`💬 Mensagem: "${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"`));
      console.log(chalk.blue('─'.repeat(80)));
      
      // Verificar se a mensagem contém "Smiles" e destacar
      if (messageText.toLowerCase().includes('smiles')) {
        console.log(chalk.bold.red('🚨 MENSAGEM COM "SMILES" DETECTADA!'));
        console.log(chalk.red(`📝 Conteúdo: "${messageText}"`));
        console.log(chalk.blue('═'.repeat(80)));
      }
    } else {
      // Mensagens de outros grupos (menos destacadas)
      console.log(chalk.gray(`[${timestamp}] ${groupName}: ${senderName} - ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Erro ao processar mensagem:'), error);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🔄 Encerrando POC...'));
  
  if (sock && isConnected) {
    await sock.logout();
  }
  
  console.log(chalk.green('✅ POC finalizada com sucesso!'));
  process.exit(0);
});

// Iniciar POC apenas se este arquivo for executado diretamente
if (require.main === module) {
  startPOC().catch(console.error);
}

// Exportar as funções para uso em outros módulos
module.exports = { 
  startPOC, 
  fetchTargetGroups, 
  fetchLastSmilesMessages, 
  handleNewMessage, 
  getMessageText 
};