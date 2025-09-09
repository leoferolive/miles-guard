#!/usr/bin/env node

/**
 * MilesGuard Setup Script
 * Interactive setup and validation for development and testing
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title.toUpperCase(), 'cyan'));
  console.log('='.repeat(60));
}

function printStep(step, total, description) {
  console.log(`\n${colorize(`[${step}/${total}]`, 'blue')} ${colorize(description, 'bright')}`);
}

function printSuccess(message) {
  console.log(`${colorize('✅', 'green')} ${message}`);
}

function printError(message) {
  console.log(`${colorize('❌', 'red')} ${message}`);
}

function printWarning(message) {
  console.log(`${colorize('⚠️ ', 'yellow')} ${message}`);
}

function printInfo(message) {
  console.log(`${colorize('ℹ️ ', 'blue')} ${message}`);
}

class MilesGuardSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  async runCommand(command, description, silent = false) {
    if (!silent) {
      console.log(colorize(`Running: ${description}...`, 'blue'));
    }
    
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], {
        stdio: silent ? 'pipe' : 'inherit',
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      if (silent) {
        child.stdout.on('data', (data) => stdout += data.toString());
        child.stderr.on('data', (data) => stderr += data.toString());
      }

      child.on('close', (code) => {
        resolve({ success: code === 0, stdout, stderr, code });
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  async checkPrerequisites() {
    printStep(1, 6, 'Checking Prerequisites');

    // Check Node.js version
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
      
      if (majorVersion >= 16) {
        printSuccess(`Node.js ${nodeVersion} (✓ Compatible)`);
      } else {
        printError(`Node.js ${nodeVersion} (✗ Requires v16+)`);
        return false;
      }
    } catch (error) {
      printError('Node.js not detected');
      return false;
    }

    // Check npm
    const npmResult = await this.runCommand('npm --version', 'Check npm', true);
    if (npmResult.success) {
      printSuccess(`npm v${npmResult.stdout.trim()} (✓ Available)`);
    } else {
      printError('npm not available');
      return false;
    }

    // Check if git is available (optional but recommended)
    const gitResult = await this.runCommand('git --version', 'Check git', true);
    if (gitResult.success) {
      printSuccess(`${gitResult.stdout.trim()} (✓ Available)`);
    } else {
      printWarning('Git not available (optional)');
    }

    return true;
  }

  async installDependencies() {
    printStep(2, 6, 'Installing Dependencies');

    // Check if node_modules exists
    if (fs.existsSync('node_modules')) {
      const answer = await this.question('Dependencies already installed. Reinstall? (y/N): ');
      if (answer.toLowerCase() !== 'y') {
        printInfo('Skipping dependency installation');
        return true;
      }
    }

    // Install dependencies
    const installResult = await this.runCommand('npm install', 'Install dependencies');
    
    if (installResult.success) {
      printSuccess('Dependencies installed successfully');
      
      // Verify critical packages
      const criticalPackages = [
        '@whiskeysockets/baileys',
        'winston',
        'zod',
        'mocha',
        'chai'
      ];

      let allInstalled = true;
      for (const pkg of criticalPackages) {
        if (fs.existsSync(path.join('node_modules', pkg))) {
          printInfo(`✓ ${pkg}`);
        } else {
          printError(`✗ ${pkg} not found`);
          allInstalled = false;
        }
      }
      
      return allInstalled;
    } else {
      printError('Failed to install dependencies');
      return false;
    }
  }

  async createDirectories() {
    printStep(3, 6, 'Creating Required Directories');

    const requiredDirs = [
      'logs',
      'data',
      'temp',
      'tests/temp'
    ];

    for (const dir of requiredDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          printSuccess(`Created directory: ${dir}`);
        } else {
          printInfo(`Directory exists: ${dir}`);
        }
      } catch (error) {
        printError(`Failed to create directory ${dir}: ${error.message}`);
        return false;
      }
    }

    return true;
  }

  async setupEnvironment() {
    printStep(4, 6, 'Setting Up Environment');

    // Create .env.example if it doesn't exist
    const envExamplePath = '.env.example';
    if (!fs.existsSync(envExamplePath)) {
      const envExample = `# MilesGuard Environment Configuration
# Copy this file to .env and configure your values

# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# WhatsApp Configuration
WHATSAPP_SESSION_NAME=milesguard

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/milesguard.log

# Application Configuration
NODE_ENV=development
PORT=3000

# Rate Limiting (messages per minute)
RATE_LIMIT=60

# File Storage
DATA_DIRECTORY=./data
LOGS_DIRECTORY=./logs

# Notification Settings
NOTIFICATION_ENABLED=true
FILE_STORAGE_ENABLED=true
`;

      try {
        fs.writeFileSync(envExamplePath, envExample);
        printSuccess('Created .env.example');
      } catch (error) {
        printError(`Failed to create .env.example: ${error.message}`);
      }
    } else {
      printInfo('.env.example already exists');
    }

    // Check if .env exists
    if (!fs.existsSync('.env')) {
      const createEnv = await this.question('Create .env file from example? (y/N): ');
      if (createEnv.toLowerCase() === 'y') {
        try {
          fs.copyFileSync(envExamplePath, '.env');
          printSuccess('Created .env file');
          printWarning('Please edit .env with your actual configuration values');
        } catch (error) {
          printError(`Failed to create .env: ${error.message}`);
        }
      }
    } else {
      printInfo('.env file already exists');
    }

    return true;
  }

  async runTests() {
    printStep(5, 6, 'Running Test Suite');

    printInfo('This may take a moment...');

    // Run the test suite
    const testResult = await this.runCommand('node scripts/test.js', 'Run test suite', true);

    if (testResult.success) {
      printSuccess('All tests passed!');
      
      // Try to parse test results if available
      if (fs.existsSync('test-results.json')) {
        try {
          const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
          printInfo(`Tests: ${results.summary.passing} passing, ${results.summary.failing} failing`);
          printInfo(`Success rate: ${results.summary.successRate}%`);
        } catch (error) {
          printInfo('Test results available in test-results.json');
        }
      }
      
      return true;
    } else {
      printError('Some tests failed');
      printWarning('Check test output above for details');
      
      const continueSetup = await this.question('Continue with setup anyway? (y/N): ');
      return continueSetup.toLowerCase() === 'y';
    }
  }

  async finalValidation() {
    printStep(6, 6, 'Final Validation');

    // Run the validator
    const validationResult = await this.runCommand('node scripts/validate.js', 'Run application validator', true);

    if (validationResult.success) {
      printSuccess('Application validation passed!');
      
      // Try to parse validation results
      if (fs.existsSync('validation-report.json')) {
        try {
          const report = JSON.parse(fs.readFileSync('validation-report.json', 'utf8'));
          printInfo(`Validation: ${report.summary.passed} passed, ${report.summary.failed} failed`);
          printInfo(`Success rate: ${report.summary.successRate}%`);
        } catch (error) {
          printInfo('Validation report available in validation-report.json');
        }
      }
      
      return true;
    } else {
      printWarning('Application validation found issues');
      printInfo('Check validation-report.json for details');
      return false;
    }
  }

  async showCompletionInstructions(success) {
    printHeader('Setup Complete');

    if (success) {
      console.log(colorize('🎉 MilesGuard setup completed successfully!', 'green'));
      
      console.log(colorize('\n📋 Next Steps:', 'cyan'));
      console.log('1. Edit .env with your actual configuration values');
      console.log('2. Run the configuration wizard: npm start');
      console.log('3. Set up your WhatsApp and Telegram credentials');
      console.log('4. Start monitoring: npm run prod');
      
      console.log(colorize('\n🔧 Available Commands:', 'cyan'));
      console.log('  npm start          - Start in development mode');
      console.log('  npm run prod       - Start with PM2 (production)');
      console.log('  npm test           - Run full test suite');
      console.log('  npm run logs       - View application logs');
      console.log('  npm run stop       - Stop PM2 process');
      
      console.log(colorize('\n🧪 Testing Commands:', 'cyan'));
      console.log('  node scripts/test.js       - Run comprehensive tests');
      console.log('  node scripts/validate.js   - Validate application');
      console.log('  npm run test unit          - Run unit tests only');
      console.log('  npm run test integration   - Run integration tests only');
      
    } else {
      console.log(colorize('⚠️  Setup completed with issues', 'yellow'));
      console.log('Please review the errors above and run the setup again.');
      
      console.log(colorize('\n🔧 Troubleshooting:', 'cyan'));
      console.log('  node scripts/validate.js   - Check what needs fixing');
      console.log('  npm install                 - Reinstall dependencies');
      console.log('  node scripts/setup.js      - Run setup again');
    }

    console.log(colorize('\n📚 Documentation:', 'cyan'));
    console.log('  README.md      - Project overview and usage');
    console.log('  CLAUDE.md      - Development guide');
    console.log('  TEST_ROADMAP.md - Testing documentation');
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    printHeader('MilesGuard Development Setup');
    
    console.log(colorize('Welcome to MilesGuard setup!', 'cyan'));
    console.log('This script will prepare your development environment.\n');

    try {
      let success = true;
      
      success = await this.checkPrerequisites() && success;
      if (!success) {
        console.log(colorize('\n❌ Prerequisites check failed. Please install required software.', 'red'));
        this.rl.close();
        process.exit(1);
      }

      success = await this.installDependencies() && success;
      success = await this.createDirectories() && success;
      success = await this.setupEnvironment() && success;
      success = await this.runTests() && success;
      success = await this.finalValidation() && success;

      await this.showCompletionInstructions(success);
      
      this.rl.close();
      process.exit(success ? 0 : 1);
      
    } catch (error) {
      printError(`Setup failed: ${error.message}`);
      this.rl.close();
      process.exit(1);
    }
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(colorize('MilesGuard Setup Script', 'cyan'));
  console.log('\nUsage:');
  console.log('  node scripts/setup.js     - Run interactive setup');
  console.log('  node scripts/setup.js -h  - Show this help');
  console.log('\nThis script will:');
  console.log('  • Check prerequisites (Node.js, npm)');
  console.log('  • Install dependencies');
  console.log('  • Create required directories');
  console.log('  • Set up environment files');
  console.log('  • Run test suite');
  console.log('  • Validate application setup');
  process.exit(0);
}

// Run setup
if (require.main === module) {
  const setup = new MilesGuardSetup();
  setup.run().catch(console.error);
}

module.exports = MilesGuardSetup;