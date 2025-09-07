# FASE 4 - PM2 e Estabilidade ⚙️

**Duração:** 2 dias  
**Objetivo:** Configurar execução contínua e confiável com PM2

## 1. Configuração PM2

### Dependencies
```json
{
  "devDependencies": {
    "pm2": "^5.3.0"
  }
}
```

### Ecosystem Config (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [{
    name: 'milesguard',
    script: 'src/index.js',
    cwd: '/home/user/MilesGuard',
    
    // Configurações de execução
    instances: 1,
    exec_mode: 'fork',
    
    // Auto-restart
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    
    // Gestão de logs
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Variáveis de ambiente
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    
    // Configurações avançadas
    min_uptime: '10s',
    max_restarts: 5,
    restart_delay: 5000,
    
    // Health check
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }]
};
```

### Advanced Configuration Options
```javascript
// Configurações específicas para ambiente:
const environments = {
  development: {
    watch: true,
    ignore_watch: ['node_modules', 'logs', 'sessions'],
    env: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      DEBUG_MODE: true
    }
  },
  
  production: {
    instances: 1, // WhatsApp connection deve ser única
    exec_mode: 'fork',
    max_memory_restart: '500M',
    kill_timeout: 5000,
    wait_ready: true, // Esperar sinal ready do app
    listen_timeout: 10000
  }
};
```

## 2. Scripts NPM

### Package.json Update
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "NODE_ENV=development pm2 start ecosystem.config.js --env development",
    "prod": "NODE_ENV=production pm2 start ecosystem.config.js --env production",
    "restart": "pm2 restart milesguard",
    "stop": "pm2 stop milesguard",
    "delete": "pm2 delete milesguard",
    "logs": "pm2 logs milesguard --lines 100",
    "monit": "pm2 monit",
    "status": "pm2 status milesguard",
    "flush": "pm2 flush milesguard",
    "reload": "pm2 reload milesguard",
    "save": "pm2 save",
    "resurrect": "pm2 resurrect",
    "startup": "pm2 startup",
    "unstartup": "pm2 unstartup"
  }
}
```

### Process Management Scripts

#### Startup Script (`scripts/start.sh`)
```bash
#!/bin/bash
set -e

echo "🚀 Starting MilesGuard in production mode..."

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 not found. Installing..."
    npm install -g pm2
fi

# Verificar configurações
if [ ! -f "config.json" ]; then
    echo "❌ config.json not found. Run npm run config first."
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ .env not found. Create environment file first."
    exit 1
fi

# Criar diretórios necessários
mkdir -p logs sessions

# Iniciar aplicação
npm run prod

# Configurar startup automático (primeira vez)
if [ "$1" = "--setup-startup" ]; then
    pm2 startup
    pm2 save
fi

echo "✅ MilesGuard started successfully!"
echo "📊 Use 'npm run monit' to monitor the process"
```

#### Health Check Script (`scripts/health-check.js`)
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function healthCheck() {
  const checks = [
    checkConfigFile,
    checkEnvFile, 
    checkLogDirectory,
    checkSessionDirectory,
    checkMemoryUsage,
    checkLastActivity
  ];
  
  let allGood = true;
  
  for (const check of checks) {
    try {
      await check();
      console.log(`✅ ${check.name} passed`);
    } catch (error) {
      console.log(`❌ ${check.name} failed: ${error.message}`);
      allGood = false;
    }
  }
  
  if (allGood) {
    console.log('\n🎉 All health checks passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some health checks failed');
    process.exit(1);
  }
}

function checkConfigFile() {
  if (!fs.existsSync('config.json')) {
    throw new Error('config.json not found');
  }
  
  const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
  if (!config.subgrupos || config.subgrupos.length === 0) {
    throw new Error('No subgroups configured');
  }
}

// ... outras funções de check

healthCheck();
```

## 3. Health Checks e Monitoring

### Application Health Check (`src/core/healthCheck.js`)
```javascript
class HealthChecker {
  constructor() {
    this.lastWhatsAppMessage = null;
    this.lastTelegramSent = null;
    this.connectionStatus = 'disconnected';
    this.startTime = Date.now();
  }
  
  // Verificações principais:
  checkWhatsAppConnection() {
    const maxSilence = 5 * 60 * 1000; // 5 minutos
    const timeSinceLastMessage = Date.now() - (this.lastWhatsAppMessage || 0);
    
    if (timeSinceLastMessage > maxSilence && this.connectionStatus === 'open') {
      return { healthy: false, reason: 'WhatsApp silent too long' };
    }
    
    return { healthy: true };
  }
  
  checkMemoryUsage() {
    const used = process.memoryUsage();
    const maxMemoryMB = 200;
    
    if (used.rss / 1024 / 1024 > maxMemoryMB) {
      return { healthy: false, reason: 'High memory usage' };
    }
    
    return { healthy: true };
  }
  
  checkDiskSpace() {
    // Verificar espaço em disco para logs
  }
  
  async performFullCheck() {
    const checks = [
      this.checkWhatsAppConnection(),
      this.checkMemoryUsage(),
      this.checkDiskSpace()
    ];
    
    const unhealthy = checks.filter(check => !check.healthy);
    
    if (unhealthy.length > 0) {
      logger.warn('Health check failed', { failures: unhealthy });
      return false;
    }
    
    return true;
  }
}
```

### PM2 Ready Signal (`src/index.js`)
```javascript
// Modificar entry point para enviar sinal ready:
async function startApplication() {
  try {
    // ... inicialização existente
    
    await connectToWhatsApp();
    await initializeNotifications();
    
    // Enviar sinal ready para PM2
    if (process.send) {
      process.send('ready');
    }
    
    logger.info('MilesGuard started successfully');
    
    // Setup health check interval
    const healthChecker = new HealthChecker();
    setInterval(async () => {
      const isHealthy = await healthChecker.performFullCheck();
      if (!isHealthy) {
        logger.error('Health check failed - considering restart');
      }
    }, 60000); // 1 minuto
    
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  // Fechar conexões
  if (whatsappSocket) {
    await whatsappSocket.logout();
  }
  
  // Finalizar processos em background
  clearInterval(healthCheckInterval);
  
  // Exit
  process.exit(0);
}

startApplication();
```

## 4. Log Management

### Log Rotation com Winston
```javascript
// Configuração avançada de logs em src/core/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console para desenvolvimento
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Arquivo principal com rotação
    new winston.transports.DailyRotateFile({
      filename: 'logs/milesguard-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d', // 2 semanas
      auditFile: 'logs/.audit.json'
    }),
    
    // Arquivo apenas para erros
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d' // 1 mês
    })
  ]
});
```

### PM2 Log Management
```bash
# Comandos para gestão de logs:
pm2 logs milesguard --lines 100    # Últimas 100 linhas
pm2 logs milesguard --timestamp    # Com timestamp
pm2 flush milesguard               # Limpar logs PM2
pm2 logs --json                    # Output JSON
pm2 logs --raw                     # Raw output sem cores
```

## 5. Monitoring e Alertas

### Process Monitoring (`src/core/processMonitor.js`)
```javascript
class ProcessMonitor {
  constructor() {
    this.metrics = {
      messagesProcessed: 0,
      notificationsSent: 0,
      errors: 0,
      uptime: Date.now(),
      memoryPeak: 0
    };
    
    this.setupMetricsCollection();
  }
  
  setupMetricsCollection() {
    // Coletar métricas a cada minuto
    setInterval(() => {
      this.collectSystemMetrics();
      this.logMetrics();
    }, 60000);
    
    // Reset diário de contadores
    setInterval(() => {
      this.resetDailyCounters();
    }, 24 * 60 * 60 * 1000);
  }
  
  collectSystemMetrics() {
    const memory = process.memoryUsage();
    this.metrics.currentMemory = Math.round(memory.rss / 1024 / 1024); // MB
    this.metrics.memoryPeak = Math.max(this.metrics.memoryPeak, this.metrics.currentMemory);
    
    // CPU usage (aproximado)
    const cpuUsage = process.cpuUsage();
    this.metrics.cpuUser = cpuUsage.user;
    this.metrics.cpuSystem = cpuUsage.system;
  }
  
  logMetrics() {
    logger.info('System metrics', {
      metrics: this.metrics,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Alert System
```javascript
// Sistema de alertas para situações críticas:
class AlertSystem {
  constructor(telegram, config) {
    this.telegram = telegram;
    this.config = config;
    this.alertCooldown = new Map(); // Evitar spam
  }
  
  async sendAlert(type, message, cooldownMinutes = 15) {
    const cooldownKey = `${type}-${message}`;
    
    if (this.isInCooldown(cooldownKey, cooldownMinutes)) {
      return; // Skip alert
    }
    
    const alertMessage = `🚨 *MilesGuard Alert*\n\n` +
      `Type: ${type}\n` +
      `Message: ${message}\n` +
      `Time: ${new Date().toLocaleString()}`;
    
    try {
      await this.telegram.sendMessage(alertMessage);
      this.setCooldown(cooldownKey);
    } catch (error) {
      logger.error('Failed to send alert', { error, type, message });
    }
  }
  
  // Tipos de alerta:
  async connectionLost() {
    await this.sendAlert('CONNECTION', 'WhatsApp connection lost');
  }
  
  async highMemoryUsage(usage) {
    await this.sendAlert('MEMORY', `High memory usage: ${usage}MB`);
  }
  
  async tooManyRestarts(count) {
    await this.sendAlert('RESTART', `Too many restarts: ${count} in last hour`);
  }
}
```

## 6. Deployment Automation

### Deployment Script (`scripts/deploy.sh`)
```bash
#!/bin/bash
set -e

echo "🚀 Deploying MilesGuard..."

# Backup configuração atual
if [ -d "backup" ]; then
    rm -rf backup
fi
mkdir backup
cp -r config.json logs sessions backup/ 2>/dev/null || true

# Atualizar dependências
npm ci --only=production

# Executar health check pré-deploy
npm run health-check

# Restart graceful com PM2
if pm2 describe milesguard > /dev/null 2>&1; then
    echo "📦 Restarting existing process..."
    npm run restart
else
    echo "🆕 Starting new process..."
    npm run prod
fi

# Verificar se subiu corretamente
sleep 5
npm run status

echo "✅ Deployment complete!"
echo "📊 Check logs with: npm run logs"
```

## 7. Production Checklist

### Pré-Production
```bash
# Checklist completo antes de ir para produção:
□ Configuração do bot Telegram testada
□ Arquivo .env com todas as variáveis
□ config.json válido e testado
□ Health checks funcionando
□ Logs configurados com rotação
□ PM2 ecosystem configurado
□ Scripts de deploy testados
□ Backup e restore testados
□ Memory limits definidos
□ Graceful shutdown implementado
```

### Comandos Essenciais de Produção
```bash
# Status e monitoramento
npm run status          # Status do processo
npm run monit          # Monitor interativo
npm run logs           # Ver logs em tempo real

# Gerenciamento
npm run restart        # Restart seguro
npm run reload         # Reload sem downtime
npm run stop           # Parar processo

# Manutenção
npm run flush          # Limpar logs PM2
npm run save           # Salvar configuração PM2
npm run health-check   # Verificar saúde do sistema
```

## 8. Troubleshooting

### Problemas Comuns e Soluções

#### 1. Processo não inicia
```bash
# Debug steps:
pm2 logs milesguard --lines 50  # Ver logs de erro
npm run health-check            # Verificar pré-requisitos
node src/index.js               # Testar diretamente
```

#### 2. Memory leaks
```bash
# Monitoramento:
pm2 monit                       # Monitorar uso de memória
pm2 restart milesguard          # Restart se necessário
```

#### 3. WhatsApp desconecta frequentemente
```bash
# Verificar:
- Qualidade da conexão de internet
- Rate limiting nas mensagens
- Versão do Baileys atualizada
- Logs de erro específicos
```

### Debug Mode
```javascript
// Ativar debug detalhado:
DEBUG_MODE=true npm run prod

// Ou via ecosystem.config.js:
env: {
  NODE_ENV: 'production',
  LOG_LEVEL: 'debug',
  DEBUG_MODE: 'true'
}
```

## 9. Outputs da Fase

### Funcionalidades Implementadas
- ✅ PM2 configurado para produção 24/7
- ✅ Auto-restart em crashes
- ✅ Health checks automatizados
- ✅ Log rotation e management
- ✅ Memory monitoring
- ✅ Graceful shutdown
- ✅ Scripts de deployment
- ✅ Sistema de alertas

### Sistema de Produção Pronto
Após esta fase, o MilesGuard estará pronto para operação contínua com:
- Monitoramento automático de recursos
- Restart automático em falhas
- Logs organizados e rotativos
- Health checks periódicos
- Alertas em situações críticas

## 10. Próxima Fase

A Fase 5 focará em refinamentos e melhorias de qualidade de vida, mas o sistema já está estável e confiável para uso 24/7.