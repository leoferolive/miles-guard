const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs').promises;
const path = require('path');
const { whatsappLogger } = require('../../utils/logger');
const env = require('../../config/environment');

class SessionManager {
  constructor() {
    this.sessionPath = env.WA_SESSION_PATH;
    this.authState = null;
    this.saveCreds = null;
  }

  async initialize() {
    try {
      // Ensure session directory exists
      await this.ensureSessionDirectory();
      
      // Load or create auth state
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      this.authState = state;
      this.saveCreds = saveCreds;
      
      whatsappLogger.info('Session manager initialized', { sessionPath: this.sessionPath });
      return { state, saveCreds };
    } catch (error) {
      whatsappLogger.logError('session_init', error);
      throw error;
    }
  }

  async ensureSessionDirectory() {
    try {
      await fs.mkdir(this.sessionPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async clearSession() {
    try {
      whatsappLogger.info('Clearing session data', { sessionPath: this.sessionPath });
      
      // Remove session directory and recreate it
      await fs.rm(this.sessionPath, { recursive: true, force: true });
      await this.ensureSessionDirectory();
      
      // Re-initialize with clean state
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      this.authState = state;
      this.saveCreds = saveCreds;
      
      whatsappLogger.info('Session cleared and reinitialized');
      return { state, saveCreds };
    } catch (error) {
      whatsappLogger.logError('session_clear', error);
      throw error;
    }
  }

  async isValidSession() {
    try {
      if (!this.authState || !this.authState.creds) {
        return false;
      }

      // Check if essential credentials exist
      const creds = this.authState.creds;
      return !!(creds.noiseKey && creds.signedIdentityKey && creds.signedPreKey);
    } catch (error) {
      whatsappLogger.logError('session_validate', error);
      return false;
    }
  }

  async backupSession(backupPath) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(backupPath || './backups', `session-${timestamp}`);
      
      await fs.mkdir(backupDir, { recursive: true });
      
      // Copy session files
      const files = await fs.readdir(this.sessionPath);
      for (const file of files) {
        const srcPath = path.join(this.sessionPath, file);
        const destPath = path.join(backupDir, file);
        await fs.copyFile(srcPath, destPath);
      }
      
      whatsappLogger.info('Session backed up successfully', { backupDir });
      return backupDir;
    } catch (error) {
      whatsappLogger.logError('session_backup', error);
      throw error;
    }
  }

  async restoreSession(backupPath) {
    try {
      whatsappLogger.info('Restoring session from backup', { backupPath });
      
      // Clear current session
      await fs.rm(this.sessionPath, { recursive: true, force: true });
      await this.ensureSessionDirectory();
      
      // Copy backup files
      const files = await fs.readdir(backupPath);
      for (const file of files) {
        const srcPath = path.join(backupPath, file);
        const destPath = path.join(this.sessionPath, file);
        await fs.copyFile(srcPath, destPath);
      }
      
      // Re-initialize
      await this.initialize();
      
      whatsappLogger.info('Session restored successfully');
      return true;
    } catch (error) {
      whatsappLogger.logError('session_restore', error);
      throw error;
    }
  }

  getAuthState() {
    return this.authState;
  }

  getCredentialsSaver() {
    return this.saveCreds;
  }
}

module.exports = SessionManager;