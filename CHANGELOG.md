# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ✅ **Interactive Configuration Wizard**: New `npm run config` command for easy setup
- ✅ **Optional Telegram Configuration**: System now works without Telegram, saving only to local files
- ✅ **Flexible Notification System**: Users can choose between Telegram, local files, or both

### Changed
- 🔧 **Enhanced Startup Process**: Automatic detection of missing Telegram configuration
- 🔧 **Improved Documentation**: Updated README with new configuration options
- 🔧 **Better Error Handling**: More informative messages when services are not configured

## [1.0.0] - 2024-01-08

## [1.0.0] - 2024-01-08

### Added
- ✅ **Clean Architecture Implementation**: Complete refactoring with clean separation of concerns
- ✅ **WhatsApp Integration**: Full Baileys integration with session persistence and reconnection handling
- ✅ **Message Processing**: Comprehensive message handling and keyword-based filtering system  
- ✅ **Dual Notification System**: Real-time Telegram notifications + organized local file storage
- ✅ **Service Layer**: Complete service architecture with dependency injection
- ✅ **PM2 Integration**: Production-ready process management with auto-restart and monitoring
- ✅ **POC Scripts**: Quick WhatsApp connection testing with `npm run poc`
- ✅ **Development Tools**: File watching with `npm run dev` for development workflow
- 🔧 **CI/CD Pipeline**: GitHub Actions for automated testing and releases
- 📦 **Version Management**: Automated semantic versioning and changelog generation

### Infrastructure
- **GitHub Actions**: Automated CI pipeline with Node.js 18.x and 20.x testing
- **Security Audits**: Automated vulnerability scanning and dependency checks
- **Release Automation**: Semantic versioning based on commit message conventions
- **Version Scripts**: Manual version bumping commands (`npm run version:patch/minor/major`)

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

### Key Features
- **Silent Background Monitoring**: Monitors multiple WhatsApp subgroups without manual intervention
- **Smart Filtering**: Configurable keyword-based filtering with case-insensitive matching
- **Dual Storage**: Telegram notifications + local JSON/TXT files organized by date and subgroup
- **24/7 Operation**: PM2-managed process with health monitoring and auto-restart
- **Easy Configuration**: 3-input setup (community, subgroups, keywords)

### Technical Stack
- **Runtime**: Node.js
- **WhatsApp API**: @whiskeysockets/baileys
- **Notifications**: node-telegram-bot-api
- **Logging**: winston
- **Process Manager**: PM2
- **Testing**: Mocha, Chai, Sinon
- **Validation**: Zod

### Commit Message Convention
- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)  
- `BREAKING:` or `major:` - Breaking changes (major version bump)
- `chore:` - Maintenance tasks
- `docs:` - Documentation updates

---

*This changelog is automatically maintained. For detailed commit history, use `npm run changelog`.*