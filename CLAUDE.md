# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MilesGuard is a WhatsApp message aggregator that monitors specific subgroups and centralizes relevant offers through automated filtering and dual notification system (Telegram + local files). It eliminates the need to manually check multiple WhatsApp groups daily.

## Key Dependencies

- **@whiskeysockets/baileys**: WhatsApp Web API for connection and message handling
- **node-telegram-bot-api**: Telegram notifications
- **winston**: Structured logging system
- **inquirer**: Interactive CLI wizard for configuration
- **qrcode-terminal**: WhatsApp QR code authentication
- **zod**: Configuration schema validation
- **dotenv**: Environment variable management

## Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm start

# Production with PM2
npm run prod

# View logs
npm run logs

# Stop service
npm run stop

# PM2 monitoring
pm2 status milesguard
pm2 logs milesguard
pm2 monit
```

## Project Architecture

The system follows a 6-phase development plan:

### Core Components
1. **WhatsApp Connection**: Baileys-based connection with QR authentication and session persistence
2. **Filter Engine**: Keyword-based filtering system with case-insensitive matching
3. **Dual Notification System**:
   - Real-time Telegram notifications
   - Local JSON/TXT file storage organized by date and subgroup
4. **Configuration Wizard**: Interactive setup for communities, subgroups, and keywords
5. **PM2 Integration**: 24/7 process management with auto-restart and health checks

### Expected File Structure
```
logs/
├── 2024-04-20/
│   ├── passagens-sul.json
│   ├── compra-pontos.json
│   └── resumo-diario.txt
├── 2024-04-21/
│   └── ...
config.json
ecosystem.config.js
```

### Configuration Schema
```json
{
  "comunidade": "M01 Comunidade Masters",
  "subgrupos": [
    "Passagens SUL",
    "Compra de Pontos"
  ],
  "palavras_chave": [
    "100%",
    "bônus", 
    "latam"
  ],
  "case_sensitive": false
}
```

## Development Workflow

1. **WhatsApp Integration**: Implement Baileys connection with QR authentication
2. **Message Filtering**: Create keyword matching system for relevant message detection
3. **Notification System**: Set up Telegram bot and local file storage
4. **Process Management**: Configure PM2 for production deployment
5. **Configuration Management**: Build interactive wizard with Inquirer

## Key Features

- **Silent Background Monitoring**: Monitors multiple WhatsApp subgroups without manual intervention
- **Smart Filtering**: Keyword-based relevance filtering with configurable criteria
- **Dual Storage**: Real-time Telegram notifications + organized local file backup
- **24/7 Operation**: PM2-managed process with auto-restart and health monitoring
- **Easy Setup**: 3-input configuration (community, subgroups, keywords)

## Future Deployment

The system is designed for eventual deployment on Raspberry Pi for dedicated 24/7 operation with minimal resource usage.