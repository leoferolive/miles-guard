const { makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk').default;
const EventEmitter = require('events');

const { whatsappLogger } = require('../../utils/logger');
const { createExponentialBackoff, sleep } = require('../../utils/helpers');
const env = require('../../config/environment');
const SessionManager = require('./session-manager');
const MessageHandler = require('./message-handler');

class WhatsAppConnection extends EventEmitter {
  constructor(configService) {
    super();
    this.configService = configService;
    this.sessionManager = new SessionManager();
    this.messageHandler = new MessageHandler(null, configService);
    
    this.sock = null;
    this.isConnected = false;
    this.groups = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = env.WA_RECONNECT_ATTEMPTS;
    
    // Create backoff function
    this.getBackoffDelay = createExponentialBackoff(
      env.WA_RECONNECT_DELAY, 
      30000, 
      this.maxReconnectAttempts
    );
    
    // Setup message handler events
    this.setupMessageHandlerEvents();
  }

  setupMessageHandlerEvents() {
    this.messageHandler.on('message:received', (message) => {
      this.messageHandler.filterAndProcessMessage(message, this.groups);
    });

    this.messageHandler.on('message:relevant', (relevantMessage) => {
      this.emit('message:relevant', relevantMessage);
    });
  }

  async connect() {
    try {
      whatsappLogger.connection('connecting', { attempt: this.reconnectAttempts + 1 });
      
      // Initialize session
      const { state, saveCreds } = await this.sessionManager.initialize();
      
      // Create socket
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
      });
      
      // Setup event handlers
      this.setupEventHandlers(saveCreds);
      
      return this.sock;
    } catch (error) {
      whatsappLogger.logError('connection_error', error);
      throw error;
    }
  }

  setupEventHandlers(saveCreds) {
    // Connection updates
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });
    
    // Credentials updates
    this.sock.ev.on('creds.update', saveCreds);
    
    // Messages
    this.sock.ev.on('messages.upsert', async (messageUpdate) => {
      await this.messageHandler.handleMessages(messageUpdate);
    });
    
    // Groups updates
    this.sock.ev.on('groups.update', (updates) => {
      this.handleGroupsUpdate(updates);
    });
    
    // Groups upsert (new groups)
    this.sock.ev.on('groups.upsert', (groups) => {
      this.handleGroupsUpsert(groups);
    });
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;
    
    try {
      if (qr) {
        this.handleQRCode(qr);
      }
      
      if (connection === 'close') {
        await this.handleConnectionClose(lastDisconnect);
      } else if (connection === 'open') {
        await this.handleConnectionOpen();
      } else if (connection === 'connecting') {
        whatsappLogger.connection('connecting', { reconnectAttempts: this.reconnectAttempts });
      }
    } catch (error) {
      whatsappLogger.logError('connection_update', error);
    }
  }

  handleQRCode(qr) {
    console.log(chalk.yellow('\n📱 QR Code gerado - Escaneie com seu WhatsApp:'));
    console.log(chalk.gray('   (O QR Code aparecerá abaixo)\n'));
    qrcode.generate(qr, { small: true });
    console.log(chalk.gray('\n⏳ Aguardando conexão...\n'));
    
    whatsappLogger.connection('qr_generated');
    this.emit('qr:generated', qr);
  }

  async handleConnectionClose(lastDisconnect) {
    this.isConnected = false;
    const statusCode = lastDisconnect?.error?.output?.statusCode;
    const errorMessage = lastDisconnect?.error?.output?.payload?.message;
    
    whatsappLogger.connection('closed', { 
      statusCode, 
      errorMessage,
      reconnectAttempts: this.reconnectAttempts 
    });
    
    // Handle different disconnect reasons
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
    const isConflict = errorMessage?.includes('conflict');
    
    if (isConflict) {
      await this.handleSessionConflict();
      return;
    }
    
    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      await this.attemptReconnection();
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      whatsappLogger.error('Max reconnection attempts reached');
      this.emit('connection:failed', new Error('Max reconnection attempts reached'));
    }
  }

  async handleSessionConflict() {
    whatsappLogger.warn('Session conflict detected, clearing session');
    
    try {
      await this.sessionManager.clearSession();
      this.reconnectAttempts = 0;
      await sleep(2000);
      await this.connect();
    } catch (error) {
      whatsappLogger.logError('session_conflict_resolution', error);
      this.emit('connection:error', error);
    }
  }

  async attemptReconnection() {
    this.reconnectAttempts++;
    const delay = this.getBackoffDelay(this.reconnectAttempts - 1);
    
    if (delay === null) {
      whatsappLogger.error('No more reconnection attempts available');
      return;
    }
    
    whatsappLogger.info(`Attempting reconnection in ${delay / 1000} seconds`, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts
    });
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        whatsappLogger.logError('reconnection_failed', error);
      }
    }, delay);
  }

  async handleConnectionOpen() {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    whatsappLogger.connection('open', { connected: true });
    console.log(chalk.bold.green('\n✅ Conectado ao WhatsApp com sucesso!\n'));
    
    // Fetch groups after a brief delay
    setTimeout(async () => {
      await this.fetchGroups();
    }, 2000);
    
    this.emit('connection:ready');
  }

  handleGroupsUpdate(updates) {
    for (const update of updates) {
      if (this.groups.has(update.id)) {
        const group = this.groups.get(update.id);
        whatsappLogger.info('Group updated', { 
          groupName: group.subject,
          updateKeys: Object.keys(update)
        });
        
        // Update group data
        Object.assign(group, update);
        this.emit('group:updated', group);
      }
    }
  }

  handleGroupsUpsert(groups) {
    for (const group of groups) {
      this.groups.set(group.id, group);
      whatsappLogger.info('New group added', { 
        groupName: group.subject,
        participants: group.participants?.length || 0
      });
      this.emit('group:added', group);
    }
  }

  async fetchGroups() {
    try {
      whatsappLogger.info('Fetching WhatsApp groups');
      
      const groupsData = await this.sock.groupFetchAllParticipating();
      const groupList = Object.values(groupsData);
      
      this.groups.clear();
      
      // Process and store groups
      for (const group of groupList) {
        this.groups.set(group.id, group);
      }
      
      whatsappLogger.info('Groups fetched successfully', { 
        totalGroups: groupList.length 
      });
      
      // Find and log target groups
      const targetGroups = this.findTargetGroups();
      
      console.log(chalk.bold.cyan('\n👂 Monitorando mensagens em tempo real...'));
      console.log(chalk.gray('   (As mensagens aparecerão abaixo conforme chegarem)\n'));
      
      this.emit('groups:loaded', { allGroups: groupList, targetGroups });
      
    } catch (error) {
      whatsappLogger.logError('groups_fetch', error);
      
      // If connection was closed during fetch, try to reconnect
      if (error.message?.includes('Connection Closed')) {
        setTimeout(() => this.connect(), 3000);
      }
    }
  }

  findTargetGroups() {
    const targetGroups = [];
    
    console.log(chalk.bold.green('\n📊 Grupos-alvo encontrados:\n'));
    
    for (const [groupId, group] of this.groups.entries()) {
      const groupName = group.subject;
      const participantCount = group.participants?.length || 0;
      
      if (this.configService.isTargetGroup(groupName)) {
        targetGroups.push(group);
        console.log(chalk.green(`🎯 ${groupName}`), chalk.gray(`(${participantCount} membros)`));
      }
    }
    
    if (targetGroups.length === 0) {
      console.log(chalk.yellow('⚠️  Nenhum dos grupos específicos foi encontrado'));
      console.log(chalk.gray('   Verifique se você está nos grupos corretos ou configure novos grupos'));
    }
    
    return targetGroups;
  }

  async disconnect() {
    try {
      whatsappLogger.connection('disconnecting');
      
      if (this.sock && this.isConnected) {
        await this.sock.logout();
      }
      
      this.isConnected = false;
      whatsappLogger.connection('disconnected');
      
    } catch (error) {
      whatsappLogger.logError('disconnect_error', error);
    }
  }

  // Getters
  isReady() {
    return this.isConnected && this.sock;
  }

  getGroups() {
    return Array.from(this.groups.values());
  }

  getTargetGroups() {
    return this.getGroups().filter(group => 
      this.configService.isTargetGroup(group.subject)
    );
  }

  getSocket() {
    return this.sock;
  }

  getConnectionStats() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      groupsCount: this.groups.size,
      targetGroupsCount: this.getTargetGroups().length,
      cacheStats: this.messageHandler.getCacheStats()
    };
  }
}

module.exports = WhatsAppConnection;