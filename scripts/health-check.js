#!/usr/bin/env node

/**
 * Health Check Script for MilesGuard
 * 
 * This script performs comprehensive health checks on the MilesGuard application
 * and provides detailed status information. It can be used for monitoring,
 * debugging, or automated health checking.
 * 
 * Usage:
 *   node scripts/health-check.js
 *   npm run health
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

class HealthChecker {
  constructor() {
    this.checks = {};
    this.overallStatus = 'unknown';
  }

  async performAllChecks() {
    console.log('🔍 MilesGuard Health Check\n');
    console.log('=' * 50);
    
    // Perform individual checks
    await this.checkConfiguration();
    await this.checkEnvironmentVariables();
    await this.checkDirectoryStructure();
    await this.checkLogFiles();
    await this.checkPM2Status();
    await this.checkSystemResources();
    
    // Determine overall status
    this.determineOverallStatus();
    
    // Display summary
    this.displaySummary();
    
    // Exit with appropriate code
    process.exit(this.overallStatus === 'healthy' ? 0 : 1);
  }

  async checkConfiguration() {
    const check = { name: 'Configuration', status: 'unknown', details: [] };
    
    try {
      // Check if config.json exists
      await fs.access('./config.json');
      check.details.push('✅ config.json exists');
      
      // Try to parse and validate config
      const configData = await fs.readFile('./config.json', 'utf8');
      const config = JSON.parse(configData);
      
      if (config.comunidade) check.details.push('✅ Community configured');
      else check.details.push('❌ Community not configured');
      
      if (config.subgrupos && config.subgrupos.length > 0) {
        check.details.push(`✅ ${config.subgrupos.length} subgroups configured`);
      } else {
        check.details.push('❌ No subgroups configured');
      }
      
      if (config.palavras_chave && config.palavras_chave.length > 0) {
        check.details.push(`✅ ${config.palavras_chave.length} keywords configured`);
      } else {
        check.details.push('❌ No keywords configured');
      }
      
      check.status = 'healthy';
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        check.status = 'critical';
        check.details.push('❌ config.json not found - run setup wizard');
      } else {
        check.status = 'warning';
        check.details.push(`⚠️  Configuration error: ${error.message}`);
      }
    }
    
    this.checks.configuration = check;
    this.displayCheck(check);
  }

  async checkEnvironmentVariables() {
    const check = { name: 'Environment Variables', status: 'healthy', details: [] };
    
    const requiredVars = ['WA_SESSION_PATH', 'LOG_LEVEL', 'LOG_FILE'];
    const optionalVars = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
    
    // Check required variables
    for (const varName of requiredVars) {
      if (process.env[varName]) {
        check.details.push(`✅ ${varName} is set`);
      } else {
        check.details.push(`❌ ${varName} is missing`);
        check.status = 'warning';
      }
    }
    
    // Check optional variables
    for (const varName of optionalVars) {
      if (process.env[varName]) {
        check.details.push(`✅ ${varName} is set (Telegram enabled)`);
      } else {
        check.details.push(`⚠️  ${varName} not set (Telegram disabled)`);
      }
    }
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion >= 18) {
      check.details.push(`✅ Node.js ${nodeVersion} (supported)`);
    } else {
      check.details.push(`❌ Node.js ${nodeVersion} (requires >= 18)`);
      check.status = 'critical';
    }
    
    this.checks.environment = check;
    this.displayCheck(check);
  }

  async checkDirectoryStructure() {
    const check = { name: 'Directory Structure', status: 'healthy', details: [] };
    
    const requiredDirs = [
      './logs',
      './sessions',
      './src',
      './src/core',
      './src/services',
      './src/repositories'
    ];
    
    const optionalDirs = [
      './backups',
      './scripts'
    ];
    
    // Check required directories
    for (const dir of requiredDirs) {
      try {
        const stats = await fs.stat(dir);
        if (stats.isDirectory()) {
          check.details.push(`✅ ${dir} exists`);
        } else {
          check.details.push(`❌ ${dir} exists but is not a directory`);
          check.status = 'warning';
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          check.details.push(`❌ ${dir} missing`);
          check.status = 'warning';
        }
      }
    }
    
    // Check optional directories
    for (const dir of optionalDirs) {
      try {
        await fs.stat(dir);
        check.details.push(`✅ ${dir} exists`);
      } catch (error) {
        check.details.push(`⚠️  ${dir} missing (optional)`);
      }
    }
    
    this.checks.directories = check;
    this.displayCheck(check);
  }

  async checkLogFiles() {
    const check = { name: 'Log Files', status: 'healthy', details: [] };
    
    const logFiles = [
      './logs/milesguard.log',
      './logs/error.log',
      './logs/pm2-combined.log',
      './logs/pm2-error.log'
    ];
    
    for (const logFile of logFiles) {
      try {
        const stats = await fs.stat(logFile);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const age = Math.floor((Date.now() - stats.mtime.getTime()) / (1000 * 60));
        
        check.details.push(`✅ ${logFile} (${sizeMB}MB, ${age}min old)`);
        
        // Warn about very large log files
        if (stats.size > 100 * 1024 * 1024) { // 100MB
          check.details.push(`⚠️  ${logFile} is very large (${sizeMB}MB)`);
          check.status = 'warning';
        }
        
      } catch (error) {
        if (error.code === 'ENOENT') {
          check.details.push(`⚠️  ${logFile} not found (will be created)`);
        } else {
          check.details.push(`❌ ${logFile} error: ${error.message}`);
          check.status = 'warning';
        }
      }
    }
    
    // Check disk space in logs directory
    try {
      const logDir = './logs';
      const files = await fs.readdir(logDir);
      let totalSize = 0;
      
      for (const file of files) {
        try {
          const stats = await fs.stat(path.join(logDir, file));
          totalSize += stats.size;
        } catch (error) {
          // Ignore individual file errors
        }
      }
      
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
      check.details.push(`📊 Total log directory size: ${totalSizeMB}MB`);
      
    } catch (error) {
      check.details.push(`⚠️  Could not calculate log directory size`);
    }
    
    this.checks.logFiles = check;
    this.displayCheck(check);
  }

  async checkPM2Status() {
    const check = { name: 'PM2 Status', status: 'unknown', details: [] };
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Check if PM2 is installed
      try {
        await execAsync('pm2 --version');
        check.details.push('✅ PM2 is installed');
      } catch (error) {
        check.details.push('❌ PM2 not installed globally');
        check.status = 'warning';
        this.checks.pm2 = check;
        this.displayCheck(check);
        return;
      }
      
      // Check if MilesGuard process is running
      try {
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        const milesguardProcess = processes.find(p => p.name === 'milesguard');
        
        if (milesguardProcess) {
          const status = milesguardProcess.pm2_env.status;
          const uptime = Math.floor((Date.now() - milesguardProcess.pm2_env.pm_uptime) / 1000);
          const memory = Math.round(milesguardProcess.memory / 1024 / 1024);
          const restarts = milesguardProcess.pm2_env.restart_time;
          
          if (status === 'online') {
            check.details.push(`✅ MilesGuard is running (PID: ${milesguardProcess.pid})`);
            check.details.push(`✅ Uptime: ${this.formatUptime(uptime * 1000)}`);
            check.details.push(`📊 Memory: ${memory}MB`);
            check.details.push(`🔄 Restarts: ${restarts}`);
            check.status = 'healthy';
          } else {
            check.details.push(`❌ MilesGuard status: ${status}`);
            check.status = 'critical';
          }
        } else {
          check.details.push('❌ MilesGuard process not found in PM2');
          check.status = 'warning';
        }
        
      } catch (error) {
        check.details.push('⚠️  Could not retrieve PM2 process list');
        check.status = 'warning';
      }
      
    } catch (error) {
      check.details.push(`❌ PM2 check failed: ${error.message}`);
      check.status = 'warning';
    }
    
    this.checks.pm2 = check;
    this.displayCheck(check);
  }

  async checkSystemResources() {
    const check = { name: 'System Resources', status: 'healthy', details: [] };
    
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      
      check.details.push(`📊 Heap Used: ${heapUsedMB}MB`);
      check.details.push(`📊 Heap Total: ${heapTotalMB}MB`);
      check.details.push(`📊 RSS: ${rssMB}MB`);
      
      if (heapUsedMB > 150) {
        check.details.push(`⚠️  High heap usage: ${heapUsedMB}MB`);
        check.status = 'warning';
      }
      
      if (rssMB > 200) {
        check.details.push(`⚠️  High RSS usage: ${rssMB}MB`);
        check.status = 'warning';
      }
      
      // CPU usage (basic check)
      const cpuUsage = process.cpuUsage();
      check.details.push(`📊 CPU User: ${(cpuUsage.user / 1000).toFixed(2)}ms`);
      check.details.push(`📊 CPU System: ${(cpuUsage.system / 1000).toFixed(2)}ms`);
      
      // Process uptime
      const uptime = process.uptime();
      check.details.push(`⏱️  Process uptime: ${this.formatUptime(uptime * 1000)}`);
      
    } catch (error) {
      check.details.push(`❌ System check failed: ${error.message}`);
      check.status = 'warning';
    }
    
    this.checks.systemResources = check;
    this.displayCheck(check);
  }

  determineOverallStatus() {
    const statuses = Object.values(this.checks).map(check => check.status);
    
    if (statuses.includes('critical')) {
      this.overallStatus = 'critical';
    } else if (statuses.includes('warning')) {
      this.overallStatus = 'degraded';
    } else if (statuses.every(status => status === 'healthy')) {
      this.overallStatus = 'healthy';
    } else {
      this.overallStatus = 'unknown';
    }
  }

  displayCheck(check) {
    const statusIcon = {
      'healthy': '🟢',
      'warning': '🟡',
      'critical': '🔴',
      'unknown': '⚪'
    };
    
    console.log(`\n${statusIcon[check.status]} ${check.name}`);
    console.log('-'.repeat(30));
    
    for (const detail of check.details) {
      console.log(`  ${detail}`);
    }
  }

  displaySummary() {
    const statusIcon = {
      'healthy': '🟢 HEALTHY',
      'degraded': '🟡 DEGRADED',
      'critical': '🔴 CRITICAL',
      'unknown': '⚪ UNKNOWN'
    };
    
    console.log('\n' + '='.repeat(50));
    console.log(`Overall Status: ${statusIcon[this.overallStatus]}`);
    console.log('='.repeat(50));
    
    // Quick stats
    const healthyCount = Object.values(this.checks).filter(c => c.status === 'healthy').length;
    const warningCount = Object.values(this.checks).filter(c => c.status === 'warning').length;
    const criticalCount = Object.values(this.checks).filter(c => c.status === 'critical').length;
    const totalCount = Object.keys(this.checks).length;
    
    console.log(`\n📊 Check Summary:`);
    console.log(`   Healthy: ${healthyCount}/${totalCount}`);
    if (warningCount > 0) console.log(`   Warnings: ${warningCount}/${totalCount}`);
    if (criticalCount > 0) console.log(`   Critical: ${criticalCount}/${totalCount}`);
    
    // Recommendations
    if (this.overallStatus !== 'healthy') {
      console.log('\n💡 Recommendations:');
      
      if (this.checks.configuration?.status === 'critical') {
        console.log('   • Run the configuration wizard to set up MilesGuard');
      }
      
      if (this.checks.pm2?.status === 'critical') {
        console.log('   • Install PM2 globally: npm install -g pm2');
        console.log('   • Start MilesGuard: npm run prod');
      }
      
      if (this.checks.environment?.status === 'warning') {
        console.log('   • Check your .env file and ensure required variables are set');
      }
    }
    
    console.log(`\nTimestamp: ${new Date().toLocaleString()}`);
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

// Run health check if this script is executed directly
if (require.main === module) {
  const healthChecker = new HealthChecker();
  healthChecker.performAllChecks().catch(error => {
    console.error('Health check failed:', error);
    process.exit(1);
  });
}

module.exports = HealthChecker;