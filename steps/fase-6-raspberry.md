# FASE 6 - Raspberry Pi 🥧

**Duração:** 2-3 dias (quando decidir migrar)  
**Objetivo:** Deploy em hardware dedicado para operação 24/7

## 1. Setup Raspberry Pi

### Hardware Requirements
```
Modelo mínimo: Raspberry Pi 4 (2GB RAM)
Recomendado: Raspberry Pi 4 (4GB RAM) ou Pi 5
MicroSD: 32GB Class 10 (mínimo)
Fonte: 5V 3A oficial
Dissipador: Recomendado para operação contínua
Case: Com ventilação adequada
```

### Sistema Operacional
```bash
# Raspberry Pi OS Lite (64-bit) - sem interface gráfica
# Download via Raspberry Pi Imager

# Configurações iniciais via rpi-imager:
- SSH habilitado
- Wi-Fi configurado
- Usuário: pi
- Hostname: milesguard
```

### Instalação Node.js
```bash
# SSH para o Pi
ssh pi@milesguard.local

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version  # v18.x.x
npm --version   # 9.x.x

# Instalar PM2 globalmente
sudo npm install -g pm2
```

### Dependências do Sistema
```bash
# Bibliotecas necessárias para Baileys
sudo apt-get install -y \
  build-essential \
  python3-dev \
  libnss3-dev \
  libatk-bridge2.0-dev \
  libdrm2 \
  libgtk-3-dev \
  libgbm-dev

# Para melhor performance
sudo apt-get install -y \
  htop \
  iotop \
  git \
  curl \
  wget \
  unzip
```

## 2. Deploy da Aplicação

### Transfer e Setup
```bash
# No computador local - empacotar aplicação
tar -czf milesguard-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=logs \
  --exclude=sessions \
  src/ package.json package-lock.json \
  ecosystem.config.js .env config.json

# Transferir para Pi
scp milesguard-deploy.tar.gz pi@milesguard.local:~/

# No Pi - extrair e instalar
cd ~/
tar -xzf milesguard-deploy.tar.gz
mkdir -p MilesGuard
mv src package.json package-lock.json ecosystem.config.js .env config.json MilesGuard/
cd MilesGuard

# Instalar dependências (ARM64)
npm ci --only=production

# Criar diretórios
mkdir -p logs sessions
```

### Configuração Específica ARM
```bash
# ecosystem.config.js otimizado para Pi
module.exports = {
  apps: [{
    name: 'milesguard',
    script: 'src/index.js',
    cwd: '/home/pi/MilesGuard',
    
    // Configurações ARM otimizadas
    instances: 1,
    exec_mode: 'fork',
    
    // Limites conservadores para Pi
    max_memory_restart: '300M',
    max_restarts: 3,
    restart_delay: 10000,
    
    // Logs específicos
    log_file: './logs/pi-combined.log',
    out_file: './logs/pi-out.log',
    error_file: './logs/pi-error.log',
    
    // Variáveis otimizadas
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      UV_THREADPOOL_SIZE: '2', // Menos threads para ARM
      NODE_OPTIONS: '--max-old-space-size=256' // Limite RAM
    },
    
    // Health check mais conservador
    min_uptime: '30s',
    kill_timeout: 10000,
    listen_timeout: 15000
  }]
};
```

### Performance Tuning
```javascript
// src/config/pi-optimizations.js
class PiOptimizations {
  static apply() {
    // Reduzir frequência de health checks
    process.env.HEALTH_CHECK_INTERVAL = '120000'; // 2 min
    
    // Cache menor para ARM
    process.env.CACHE_SIZE = '500';
    process.env.CACHE_TTL = '300000'; // 5 min
    
    // Rate limits mais conservadores
    process.env.TELEGRAM_RATE_LIMIT = '20'; // msgs por minuto
    process.env.FILE_WRITE_BATCH = '10'; // batch writes
    
    // GC mais frequente
    if (global.gc) {
      setInterval(() => {
        global.gc();
      }, 5 * 60 * 1000); // 5 min
    }
  }
}

module.exports = PiOptimizations;
```

## 3. Otimizações para ARM

### Memory Management
```javascript
// Monitoramento específico para Pi
class PiMemoryManager {
  constructor() {
    this.warningThreshold = 250 * 1024 * 1024; // 250MB
    this.criticalThreshold = 300 * 1024 * 1024; // 300MB
    this.setupMonitoring();
  }
  
  setupMonitoring() {
    setInterval(() => {
      const usage = process.memoryUsage();
      
      if (usage.rss > this.criticalThreshold) {
        logger.error('Critical memory usage on Pi', {
          rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
          action: 'forcing_restart'
        });
        
        // Force restart em caso crítico
        process.exit(1);
      } else if (usage.rss > this.warningThreshold) {
        logger.warn('High memory usage on Pi', {
          rss: Math.round(usage.rss / 1024 / 1024) + 'MB'
        });
        
        // Forçar garbage collection
        if (global.gc) global.gc();
      }
    }, 60000); // Check a cada minuto
  }
}
```

### Storage Optimization
```javascript
// Otimizar I/O para cartão SD
class PiStorageManager {
  constructor() {
    this.batchWrites = [];
    this.batchSize = 10;
    this.flushInterval = 30000; // 30 segundos
    this.setupBatchProcessing();
  }
  
  setupBatchProcessing() {
    // Batch writes para reduzir wear do SD card
    setInterval(() => {
      if (this.batchWrites.length > 0) {
        this.flushBatch();
      }
    }, this.flushInterval);
  }
  
  addToBatch(writeOperation) {
    this.batchWrites.push(writeOperation);
    
    if (this.batchWrites.length >= this.batchSize) {
      this.flushBatch();
    }
  }
  
  async flushBatch() {
    if (this.batchWrites.length === 0) return;
    
    const batch = [...this.batchWrites];
    this.batchWrites = [];
    
    try {
      await Promise.all(batch.map(op => op()));
      logger.debug(`Flushed ${batch.length} writes to SD`);
    } catch (error) {
      logger.error('Batch write failed', error);
      // Re-add failed writes
      this.batchWrites.unshift(...batch);
    }
  }
}
```

### Network Resilience
```javascript
// Melhor handling de conectividade no Pi
class PiNetworkManager {
  constructor() {
    this.connectionState = 'unknown';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.setupNetworkMonitoring();
  }
  
  setupNetworkMonitoring() {
    // Ping periódico para verificar conectividade
    setInterval(async () => {
      const isOnline = await this.checkConnectivity();
      
      if (!isOnline && this.connectionState === 'online') {
        logger.warn('Network connectivity lost on Pi');
        this.handleDisconnection();
      } else if (isOnline && this.connectionState === 'offline') {
        logger.info('Network connectivity restored on Pi');
        this.handleReconnection();
      }
      
      this.connectionState = isOnline ? 'online' : 'offline';
    }, 30000); // Check a cada 30 segundos
  }
  
  async checkConnectivity() {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec('ping -c 1 8.8.8.8', (error) => {
          resolve(error === null);
        });
      });
    } catch (error) {
      return false;
    }
  }
  
  handleDisconnection() {
    // Pause non-essential operations
    this.pauseNonEssentialTasks();
    
    // Queue messages for when connection returns
    this.enableOfflineMode();
  }
}
```

## 4. Startup Automático

### Systemd Service (Alternativa ao PM2)
```ini
# /etc/systemd/system/milesguard.service
[Unit]
Description=MilesGuard WhatsApp Monitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/MilesGuard
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=append:/home/pi/MilesGuard/logs/systemd-out.log
StandardError=append:/home/pi/MilesGuard/logs/systemd-error.log

# Limites de recursos
LimitNOFILE=65536
MemoryLimit=400M

# Security
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/home/pi/MilesGuard

[Install]
WantedBy=multi-user.target
```

### Setup Systemd
```bash
# Instalar service
sudo cp milesguard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable milesguard
sudo systemctl start milesguard

# Verificar status
sudo systemctl status milesguard

# Logs
sudo journalctl -u milesguard -f
```

### PM2 Startup (Alternativa)
```bash
# Configurar PM2 para boot
pm2 startup
# Executar comando mostrado pelo PM2

# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração
pm2 save

# Testar reboot
sudo reboot
# Após reboot, verificar: pm2 list
```

### Watchdog Script
```bash
#!/bin/bash
# scripts/pi-watchdog.sh

PROCESS_NAME="milesguard"
MAX_MEMORY_MB=350

while true; do
    # Verificar se processo está rodando
    if ! pgrep -f "$PROCESS_NAME" > /dev/null; then
        echo "$(date): Process not running, restarting..."
        systemctl restart milesguard
    fi
    
    # Verificar uso de memória
    MEMORY_USAGE=$(ps -C node -o pid,ppid,cmd,%mem --sort=-%mem | grep "$PROCESS_NAME" | awk '{print $4}' | cut -d. -f1)
    
    if [ ! -z "$MEMORY_USAGE" ] && [ "$MEMORY_USAGE" -gt "$MAX_MEMORY_MB" ]; then
        echo "$(date): High memory usage: ${MEMORY_USAGE}MB, restarting..."
        systemctl restart milesguard
    fi
    
    sleep 300  # Check every 5 minutes
done
```

## 5. Backup Automático

### Local Backup Script
```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/home/pi/backups"
APP_DIR="/home/pi/MilesGuard"
DATE=$(date +%Y%m%d_%H%M%S)

# Criar diretório de backup
mkdir -p "$BACKUP_DIR"

# Backup files importantes
tar -czf "$BACKUP_DIR/milesguard_backup_$DATE.tar.gz" \
  -C "$APP_DIR" \
  config.json \
  logs/ \
  sessions/

# Manter apenas últimos 7 backups
find "$BACKUP_DIR" -name "milesguard_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/milesguard_backup_$DATE.tar.gz"
```

### Sync com Google Drive (Opcional)
```bash
# Instalar rclone
curl https://rclone.org/install.sh | sudo bash

# Configurar Google Drive
rclone config

# Script de sync
#!/bin/bash
# scripts/sync-gdrive.sh

LOCAL_BACKUP="/home/pi/backups"
REMOTE_PATH="gdrive:MilesGuard-Backups"

# Upload novos backups
rclone sync "$LOCAL_BACKUP" "$REMOTE_PATH" \
  --progress \
  --log-file=/home/pi/MilesGuard/logs/rclone.log

echo "Sync to Google Drive completed"
```

### Cron Jobs
```bash
# Editar crontab
crontab -e

# Adicionar jobs:
# Backup diário às 03:00
0 3 * * * /home/pi/MilesGuard/scripts/backup.sh

# Sync com Google Drive às 04:00 (se configurado)
0 4 * * * /home/pi/MilesGuard/scripts/sync-gdrive.sh

# Reiniciar aplicação semanalmente (preventivo)
0 2 * * 0 systemctl restart milesguard

# Limpeza de logs antigos
0 1 * * * find /home/pi/MilesGuard/logs -name "*.log" -mtime +14 -delete
```

## 6. Monitoramento Remoto

### SSH Reverse Tunnel (Acesso remoto)
```bash
# Configurar acesso remoto via SSH tunnel
# No Pi - conectar a um servidor intermediário
ssh -R 2222:localhost:22 user@your-server.com -N &

# Do seu computador - conectar via servidor
ssh -p 2222 user@your-server.com
```

### Status API Simples
```javascript
// src/api/status.js - API mínima para status
const express = require('express');
const app = express();

app.get('/status', (req, res) => {
  const status = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version
  };
  
  res.json(status);
});

app.get('/health', (req, res) => {
  // Quick health check
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(3001, '0.0.0.0', () => {
  console.log('Status API running on port 3001');
});
```

### Telegram Status Commands
```javascript
// Comandos específicos para monitoramento remoto do Pi
class PiTelegramCommands extends TelegramCommands {
  setupPiCommands() {
    super.setupCommands();
    
    // Status do Pi
    this.bot.onText(/\/pi/, async (msg) => {
      const piStatus = await this.getPiSystemStatus();
      await this.bot.sendMessage(msg.chat.id, piStatus, { parse_mode: 'Markdown' });
    });
    
    // Reiniciar aplicação
    this.bot.onText(/\/restart/, async (msg) => {
      await this.bot.sendMessage(msg.chat.id, '🔄 Reiniciando MilesGuard...');
      process.exit(0); // Systemd vai reiniciar
    });
    
    // Reboot Pi
    this.bot.onText(/\/reboot/, async (msg) => {
      if (this.isAuthorizedUser(msg.from.id)) {
        await this.bot.sendMessage(msg.chat.id, '🔄 Reiniciando Raspberry Pi...');
        require('child_process').exec('sudo reboot');
      }
    });
  }
  
  async getPiSystemStatus() {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('vcgencmd measure_temp && df -h / | tail -1 && free -h | grep Mem', 
        (error, stdout) => {
          const lines = stdout.trim().split('\n');
          const temp = lines[0] || 'Unknown';
          const disk = lines[1] || 'Unknown';
          const memory = lines[2] || 'Unknown';
          
          const status = `
🥧 *Raspberry Pi Status*

🌡️ Temperature: ${temp.replace('temp=', '')}
💾 Disk: ${disk.split(/\s+/)[4]} used
🧠 Memory: ${memory.split(/\s+/)[2]} used
⚡ Uptime: ${Math.floor(process.uptime() / 3600)}h
          `;
          
          resolve(status);
        }
      );
    });
  }
}
```

## 7. Troubleshooting Pi

### Problemas Comuns

#### 1. Cartão SD corrompido
```bash
# Verificar integridade
sudo fsck -f /dev/mmcblk0p2

# Backup preventivo
sudo dd if=/dev/mmcblk0 of=/external/pi-backup.img bs=4M status=progress
```

#### 2. Overheating
```bash
# Monitorar temperatura
watch -n 1 vcgencmd measure_temp

# Throttling check
vcgencmd get_throttled

# Se 0x0 = OK, outros valores = throttling ativo
```

#### 3. WhatsApp session corrompida no Pi
```bash
# Limpar sessões e reconectar
rm -rf /home/pi/MilesGuard/sessions/*
systemctl restart milesguard
# Escanear novo QR code via logs ou VNC
```

#### 4. Problemas de conectividade Wi-Fi
```bash
# Verificar status Wi-Fi
iwconfig wlan0

# Reconnect Wi-Fi
sudo wpa_cli reconfigure

# Verificar potência do sinal
iwlist wlan0 scan | grep -E "ESSID|Quality"
```

### Scripts de Diagnóstico
```bash
#!/bin/bash
# scripts/pi-diagnostics.sh

echo "=== MilesGuard Pi Diagnostics ==="
echo

echo "System Info:"
cat /proc/version
echo "Uptime: $(uptime)"
echo "Temperature: $(vcgencmd measure_temp)"
echo "Throttling: $(vcgencmd get_throttled)"
echo

echo "Memory Usage:"
free -h
echo

echo "Disk Usage:"
df -h /
echo

echo "Network:"
ping -c 3 8.8.8.8
echo

echo "Process Status:"
if pgrep -f milesguard > /dev/null; then
    echo "✅ MilesGuard is running"
    ps aux | grep milesguard | grep -v grep
else
    echo "❌ MilesGuard is not running"
fi
echo

echo "Recent Logs:"
tail -20 /home/pi/MilesGuard/logs/pi-combined.log
```

## 8. Outputs da Fase

### Funcionalidades Implementadas
- ✅ Deploy completo no Raspberry Pi
- ✅ Otimizações específicas para ARM64
- ✅ Startup automático com Systemd/PM2
- ✅ Watchdog para monitoramento contínuo
- ✅ Backup automático local e remoto
- ✅ API de status para monitoramento
- ✅ Comandos Telegram específicos para Pi
- ✅ Scripts de diagnóstico e troubleshooting

### Sistema 24/7 Dedicado
Após esta fase, o MilesGuard opera completamente independente em hardware dedicado:
- Consumo baixo de energia
- Operação silenciosa 24/7
- Backup automático de dados
- Monitoramento remoto via Telegram
- Resistente a quedas de energia (com UPS opcional)
- Manutenção mínima necessária

## 9. Evolução Futura

Com o sistema rodando no Pi, futuras melhorias podem incluir:
- Dashboard web local com interface gráfica
- Análise de tendências e padrões de ofertas
- Integração com outros serviços (Discord, Slack)
- Machine learning para filtragem inteligente
- API REST para integrações externas

O MilesGuard está agora completo como uma solução robusta e independente para monitoramento de WhatsApp 24/7.