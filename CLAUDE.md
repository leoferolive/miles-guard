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

# Development with file watching
npm run dev

# Test WhatsApp connection (POC)
npm run poc

# Production with PM2
npm run prod

# View logs
npm run logs

# Stop service
npm run stop

# Run tests
npm test
npm run test:unit
npm run test:integration

# PM2 monitoring
pm2 status milesguard
pm2 logs milesguard
pm2 monit
```

## Project Architecture

The system implements **Clean Architecture** with clear separation of concerns:

### Project Structure
```
src/
├── index.js                    # Application entry point
├── config/                     # Environment configurations
├── core/                       # Domain core logic
│   └── whatsapp/              # WhatsApp-specific modules
├── services/                   # Application services
├── models/                     # Data models
├── repositories/              # Data access layer
└── utils/                     # Shared utilities
```

### Core Components
1. **WhatsApp Connection**: Robust Baileys-based connection system
2. **Message Handler**: Intelligent message processing
3. **Filter Service**: Configurable keyword-based filtering
4. **Notification Dispatcher**: Notification orchestration
5. **Dual Storage**: Telegram + organized local files
6. **Session Manager**: WhatsApp session management

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
tests/
├── unit/
└── integration/
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

### Current Status
The project implements a complete Clean Architecture with all major components:

1. **✅ WhatsApp Integration**: Full Baileys integration with session persistence
2. **✅ Message Processing**: Comprehensive message handling and filtering
3. **✅ Notification System**: Dual notification system (Telegram + local storage)
4. **✅ Process Management**: PM2 configuration for production deployment
5. **✅ Service Layer**: Complete service architecture with dependency injection
6. **🚧 Testing**: Unit and integration tests in development
7. **⏳ Deployment**: Raspberry Pi deployment planned

### Testing Strategy
- **Unit Tests**: Individual component testing with Mocha/Chai/Sinon
- **Integration Tests**: End-to-end workflow testing
- **POC Scripts**: `npm run poc` for quick WhatsApp connection testing

## Key Features

- **Silent Background Monitoring**: Monitors multiple WhatsApp subgroups without manual intervention
- **Smart Filtering**: Keyword-based relevance filtering with configurable criteria
- **Dual Storage**: Real-time Telegram notifications + organized local file backup
- **24/7 Operation**: PM2-managed process with auto-restart and health monitoring
- **Easy Setup**: 3-input configuration (community, subgroups, keywords)

## Future Deployment

The system is designed for eventual deployment on Raspberry Pi for dedicated 24/7 operation with minimal resource usage.