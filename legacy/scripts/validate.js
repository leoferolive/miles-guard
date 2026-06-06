#!/usr/bin/env node

/**
 * MilesGuard Application Validator
 * Validates the complete application setup, configuration, and dependencies
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

function printCheck(description, status, details = '') {
  const icon = status ? '✅' : '❌';
  const color = status ? 'green' : 'red';
  console.log(`${icon} ${colorize(description, color)} ${details ? colorize(details, 'blue') : ''}`);
}

function printWarning(description, details = '') {
  console.log(`⚠️  ${colorize(description, 'yellow')} ${details ? colorize(details, 'blue') : ''}`);
}

function printInfo(description, details = '') {
  console.log(`ℹ️  ${colorize(description, 'blue')} ${details}`);
}

class ApplicationValidator {
  constructor() {
    this.results = {
      structure: { passed: 0, failed: 0, warnings: 0 },
      dependencies: { passed: 0, failed: 0, warnings: 0 },
      configuration: { passed: 0, failed: 0, warnings: 0 },
      tests: { passed: 0, failed: 0, warnings: 0 },
      integration: { passed: 0, failed: 0, warnings: 0 }
    };
    this.issues = [];
  }

  checkFileExists(filePath, required = true) {
    const exists = fs.existsSync(filePath);
    if (required) {
      if (exists) {
        this.results.structure.passed++;
      } else {
        this.results.structure.failed++;
        this.issues.push(`Missing required file: ${filePath}`);
      }
    } else {
      if (!exists) {
        this.results.structure.warnings++;
      } else {
        this.results.structure.passed++;
      }
    }
    return exists;
  }

  async validateProjectStructure() {
    printHeader('Project Structure Validation');

    // Core files
    printCheck('package.json', this.checkFileExists('package.json'));
    printCheck('README.md', this.checkFileExists('README.md'));
    printCheck('CLAUDE.md', this.checkFileExists('CLAUDE.md'));
    printCheck('.gitignore', this.checkFileExists('.gitignore'));

    // Source structure
    printCheck('src/ directory', this.checkFileExists('src', true));
    printCheck('src/services/', this.checkFileExists('src/services', true));
    printCheck('src/models/', this.checkFileExists('src/models', true));
    printCheck('src/utils/', this.checkFileExists('src/utils', true));
    printCheck('src/config/', this.checkFileExists('src/config', true));

    // Key source files
    if (this.checkFileExists('src/services')) {
      printCheck('ConfigService', this.checkFileExists('src/services/config.service.js'));
      printCheck('FilterService', this.checkFileExists('src/services/filter.service.js'));
      printCheck('TelegramService', this.checkFileExists('src/services/telegram.service.js'));
    }

    if (this.checkFileExists('src/models')) {
      printCheck('MessageModel', this.checkFileExists('src/models/message.model.js'));
    }

    if (this.checkFileExists('src/utils')) {
      printCheck('Logger', this.checkFileExists('src/utils/logger.js'));
      printCheck('Helpers', this.checkFileExists('src/utils/helpers.js'));
    }

    // Test structure
    printCheck('tests/ directory', this.checkFileExists('tests', true));
    printCheck('tests/unit/', this.checkFileExists('tests/unit'));
    printCheck('tests/integration/', this.checkFileExists('tests/integration'));
    printCheck('tests/fixtures/', this.checkFileExists('tests/fixtures'));

    // Configuration files
    printCheck('ecosystem.config.js', this.checkFileExists('ecosystem.config.js', false));
    
    // Optional files
    printWarning('config.json not found', '(Will be created on first run)');

    console.log(`\nStructure Check: ${colorize(this.results.structure.passed + ' passed', 'green')}, ${colorize(this.results.structure.failed + ' failed', 'red')}, ${colorize(this.results.structure.warnings + ' warnings', 'yellow')}`);
  }

  async validateDependencies() {
    printHeader('Dependencies Validation');

    // Check package.json
    if (!fs.existsSync('package.json')) {
      printCheck('package.json', false, 'Required for dependency management');
      this.results.dependencies.failed++;
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    // Check core dependencies
    const requiredDeps = [
      '@whiskeysockets/baileys',
      'node-telegram-bot-api', 
      'winston',
      'inquirer',
      'qrcode-terminal',
      'zod',
      'dotenv'
    ];

    const requiredDevDeps = [
      'mocha',
      'chai',
      'sinon'
    ];

    console.log(colorize('Production Dependencies:', 'blue'));
    for (const dep of requiredDeps) {
      const exists = packageJson.dependencies && packageJson.dependencies[dep];
      printCheck(dep, exists, exists ? `v${packageJson.dependencies[dep]}` : '');
      if (exists) {
        this.results.dependencies.passed++;
      } else {
        this.results.dependencies.failed++;
        this.issues.push(`Missing dependency: ${dep}`);
      }
    }

    console.log(colorize('\nDevelopment Dependencies:', 'blue'));
    for (const dep of requiredDevDeps) {
      const exists = packageJson.devDependencies && packageJson.devDependencies[dep];
      printCheck(dep, exists, exists ? `v${packageJson.devDependencies[dep]}` : '');
      if (exists) {
        this.results.dependencies.passed++;
      } else {
        this.results.dependencies.failed++;
        this.issues.push(`Missing dev dependency: ${dep}`);
      }
    }

    // Check node_modules
    const nodeModulesExists = fs.existsSync('node_modules');
    printCheck('node_modules installed', nodeModulesExists);
    if (!nodeModulesExists) {
      this.results.dependencies.warnings++;
      printWarning('Run "npm install" to install dependencies');
    }

    // Check scripts
    console.log(colorize('\nNPM Scripts:', 'blue'));
    const expectedScripts = ['start', 'prod', 'test', 'logs', 'stop'];
    for (const script of expectedScripts) {
      const exists = packageJson.scripts && packageJson.scripts[script];
      printCheck(`npm run ${script}`, exists);
      if (exists) {
        this.results.dependencies.passed++;
      } else {
        this.results.dependencies.warnings++;
      }
    }

    console.log(`\nDependencies Check: ${colorize(this.results.dependencies.passed + ' passed', 'green')}, ${colorize(this.results.dependencies.failed + ' failed', 'red')}, ${colorize(this.results.dependencies.warnings + ' warnings', 'yellow')}`);
  }

  async validateConfiguration() {
    printHeader('Configuration Validation');

    // Check environment configuration
    if (this.checkFileExists('src/config/environment.js')) {
      try {
        const envConfig = require(path.resolve('src/config/environment.js'));
        printCheck('Environment config loaded', true);
        
        // Check required env variables structure
        const requiredEnvVars = ['LOG_LEVEL', 'LOG_FILE', 'NODE_ENV'];
        let envVarsPassed = 0;
        
        console.log(colorize('\nEnvironment Variables:', 'blue'));
        for (const envVar of requiredEnvVars) {
          if (envConfig[envVar] !== undefined) {
            printCheck(envVar, true, `"${envConfig[envVar]}"`);
            envVarsPassed++;
          } else {
            printCheck(envVar, false, 'Not defined');
          }
        }
        
        this.results.configuration.passed += envVarsPassed;
        this.results.configuration.failed += (requiredEnvVars.length - envVarsPassed);
        
      } catch (error) {
        printCheck('Environment config syntax', false, error.message);
        this.results.configuration.failed++;
      }
    }

    // Check if example config exists
    if (this.checkFileExists('config.json', false)) {
      try {
        const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        printCheck('config.json format', true);
        
        // Validate config structure
        const requiredFields = ['comunidade', 'subgrupos', 'palavras_chave'];
        let configFieldsPassed = 0;
        
        console.log(colorize('\nConfig Fields:', 'blue'));
        for (const field of requiredFields) {
          if (config[field]) {
            printCheck(field, true, Array.isArray(config[field]) ? `${config[field].length} items` : 'configured');
            configFieldsPassed++;
          } else {
            printCheck(field, false, 'Missing');
          }
        }
        
        this.results.configuration.passed += configFieldsPassed;
        this.results.configuration.failed += (requiredFields.length - configFieldsPassed);
        
      } catch (error) {
        printCheck('config.json syntax', false, error.message);
        this.results.configuration.failed++;
      }
    } else {
      printInfo('config.json', 'Will be created during setup wizard');
    }

    // Check PM2 configuration
    if (this.checkFileExists('ecosystem.config.js', false)) {
      try {
        const pm2Config = require(path.resolve('ecosystem.config.js'));
        printCheck('PM2 config loaded', true);
        
        if (pm2Config.apps && pm2Config.apps.length > 0) {
          printCheck('PM2 app configuration', true, `${pm2Config.apps.length} app(s)`);
          this.results.configuration.passed++;
        } else {
          printCheck('PM2 app configuration', false, 'No apps defined');
          this.results.configuration.failed++;
        }
        
      } catch (error) {
        printCheck('PM2 config syntax', false, error.message);
        this.results.configuration.failed++;
      }
    }

    console.log(`\nConfiguration Check: ${colorize(this.results.configuration.passed + ' passed', 'green')}, ${colorize(this.results.configuration.failed + ' failed', 'red')}, ${colorize(this.results.configuration.warnings + ' warnings', 'yellow')}`);
  }

  async runCommand(command, description) {
    return new Promise((resolve) => {
      const child = spawn('sh', ['-c', command], {
        stdio: 'pipe',
        env: { ...process.env, NODE_ENV: 'test' }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({ success: code === 0, stdout, stderr, code });
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  async validateTests() {
    printHeader('Test Suite Validation');

    // Check if we can run tests
    const nodeModulesExists = fs.existsSync('node_modules');
    if (!nodeModulesExists) {
      printCheck('Dependencies for testing', false, 'Run npm install first');
      this.results.tests.failed++;
      return;
    }

    // Run quick test validation
    console.log(colorize('Running test validation...', 'blue'));

    // Test unit tests
    const unitTestResult = await this.runCommand('NODE_ENV=test npx mocha tests/unit/**/*.test.js --timeout 5000 --reporter json', 'Unit tests');
    
    if (unitTestResult.success) {
      try {
        const testData = JSON.parse(unitTestResult.stdout);
        printCheck('Unit tests', true, `${testData.stats.passes} passing, ${testData.stats.failures} failing`);
        this.results.tests.passed += testData.stats.passes;
        this.results.tests.failed += testData.stats.failures;
      } catch (e) {
        printCheck('Unit tests', false, 'Invalid test output');
        this.results.tests.failed++;
      }
    } else {
      printCheck('Unit tests', false, 'Failed to run');
      this.results.tests.failed++;
    }

    // Test integration tests  
    const integrationTestResult = await this.runCommand('NODE_ENV=test npx mocha tests/integration/*.test.js --timeout 10000 --reporter json', 'Integration tests');
    
    if (integrationTestResult.success) {
      try {
        const testData = JSON.parse(integrationTestResult.stdout);
        printCheck('Integration tests', true, `${testData.stats.passes} passing, ${testData.stats.failures} failing`);
        this.results.tests.passed += testData.stats.passes;
        this.results.tests.failed += testData.stats.failures;
      } catch (e) {
        printCheck('Integration tests', false, 'Invalid test output');
        this.results.tests.failed++;
      }
    } else {
      printCheck('Integration tests', false, 'Failed to run');
      this.results.tests.failed++;
    }

    console.log(`\nTest Validation: ${colorize(this.results.tests.passed + ' tests passing', 'green')}, ${colorize(this.results.tests.failed + ' failing', this.results.tests.failed > 0 ? 'red' : 'green')}`);
  }

  async validateIntegration() {
    printHeader('Application Integration Check');

    // Check if core services can be imported
    console.log(colorize('Import Validation:', 'blue'));
    
    const coreModules = [
      'src/services/config.service.js',
      'src/services/filter.service.js', 
      'src/services/telegram.service.js',
      'src/models/message.model.js',
      'src/utils/logger.js',
      'src/utils/helpers.js'
    ];

    let importsPassed = 0;
    for (const modulePath of coreModules) {
      if (fs.existsSync(modulePath)) {
        try {
          require(path.resolve(modulePath));
          printCheck(path.basename(modulePath), true, 'Imported successfully');
          importsPassed++;
        } catch (error) {
          printCheck(path.basename(modulePath), false, `Import error: ${error.message}`);
          this.issues.push(`Module import failed: ${modulePath} - ${error.message}`);
        }
      } else {
        printCheck(path.basename(modulePath), false, 'File not found');
      }
    }

    this.results.integration.passed = importsPassed;
    this.results.integration.failed = coreModules.length - importsPassed;

    // Check basic functionality
    console.log(colorize('\nFunctionality Check:', 'blue'));
    
    try {
      const { systemLogger } = require(path.resolve('src/utils/logger.js'));
      systemLogger.info('Validation test');
      printCheck('Logger functionality', true);
      this.results.integration.passed++;
    } catch (error) {
      printCheck('Logger functionality', false, error.message);
      this.results.integration.failed++;
    }

    try {
      const { normalizeText } = require(path.resolve('src/utils/helpers.js'));
      const result = normalizeText('Test');
      printCheck('Helpers functionality', result === 'test', result);
      if (result === 'test') {
        this.results.integration.passed++;
      } else {
        this.results.integration.failed++;
      }
    } catch (error) {
      printCheck('Helpers functionality', false, error.message);
      this.results.integration.failed++;
    }

    console.log(`\nIntegration Check: ${colorize(this.results.integration.passed + ' passed', 'green')}, ${colorize(this.results.integration.failed + ' failed', 'red')}`);
  }

  generateReport() {
    printHeader('Validation Summary');

    const totalPassed = Object.values(this.results).reduce((sum, category) => sum + category.passed, 0);
    const totalFailed = Object.values(this.results).reduce((sum, category) => sum + category.failed, 0);
    const totalWarnings = Object.values(this.results).reduce((sum, category) => sum + (category.warnings || 0), 0);

    console.log(colorize('📊 RESULTS BY CATEGORY:', 'cyan'));
    for (const [category, result] of Object.entries(this.results)) {
      const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
      console.log(`   ${categoryName.padEnd(15)} ${colorize(result.passed + ' ✅', 'green')} ${result.failed > 0 ? colorize(result.failed + ' ❌', 'red') : ''} ${result.warnings ? colorize(result.warnings + ' ⚠️ ', 'yellow') : ''}`);
    }

    console.log(colorize('\n📈 OVERALL RESULTS:', 'magenta'));
    console.log(`   ${colorize('✅ PASSED: ' + totalPassed, 'green')}`);
    console.log(`   ${colorize('❌ FAILED: ' + totalFailed, totalFailed > 0 ? 'red' : 'green')}`);
    console.log(`   ${colorize('⚠️  WARNINGS: ' + totalWarnings, 'yellow')}`);

    const total = totalPassed + totalFailed;
    const successRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : 0;
    console.log(`   ${colorize('📊 SUCCESS RATE: ' + successRate + '%', successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red')}`);

    if (this.issues.length > 0) {
      console.log(colorize('\n🔍 ISSUES FOUND:', 'red'));
      this.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    if (totalFailed === 0) {
      console.log(colorize('🎉 VALIDATION PASSED! MilesGuard is ready to use!', 'green'));
    } else {
      console.log(colorize(`⚠️  ${totalFailed} validation issues found. Please address them before deployment.`, 'red'));
    }
    console.log('='.repeat(60));

    // Save validation report
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      issues: this.issues,
      summary: {
        total: total,
        passed: totalPassed,
        failed: totalFailed,
        warnings: totalWarnings,
        successRate: parseFloat(successRate)
      }
    };

    fs.writeFileSync('validation-report.json', JSON.stringify(report, null, 2));
    console.log(colorize('\n📄 Detailed report saved to: validation-report.json', 'blue'));

    return totalFailed === 0;
  }

  async run() {
    printHeader('MilesGuard Application Validator');
    printInfo('Validating application setup and configuration...');

    await this.validateProjectStructure();
    await this.validateDependencies();
    await this.validateConfiguration();
    await this.validateTests();
    await this.validateIntegration();

    const success = this.generateReport();
    process.exit(success ? 0 : 1);
  }
}

// Run validator
if (require.main === module) {
  const validator = new ApplicationValidator();
  validator.run().catch(console.error);
}

module.exports = ApplicationValidator;