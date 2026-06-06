#!/usr/bin/env node

/**
 * MilesGuard Test Runner Script
 * Executes comprehensive test suite and provides detailed reporting
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title.toUpperCase(), 'cyan'));
  console.log('='.repeat(60));
}

function printSection(title) {
  console.log('\n' + colorize(`🔍 ${title}`, 'blue'));
  console.log('-'.repeat(40));
}

async function runCommand(command, description, options = {}) {
  console.log(colorize(`Running: ${description}`, 'yellow'));
  
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      stdio: options.silent ? 'pipe' : 'inherit',
      env: { ...process.env, NODE_ENV: 'test' },
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        console.log(colorize('✅ PASSED', 'green'));
        resolve({ success: true, stdout, stderr, code });
      } else {
        console.log(colorize('❌ FAILED', 'red'));
        if (options.silent && (stdout || stderr)) {
          console.log('Output:', stdout);
          console.error('Error:', stderr);
        }
        resolve({ success: false, stdout, stderr, code });
      }
    });

    child.on('error', (error) => {
      console.log(colorize(`❌ ERROR: ${error.message}`, 'red'));
      reject(error);
    });
  });
}

function extractTestStats(output) {
  const passMatch = output.match(/(\d+) passing/);
  const failMatch = output.match(/(\d+) failing/);
  const pendingMatch = output.match(/(\d+) pending/);
  
  return {
    passing: passMatch ? parseInt(passMatch[1]) : 0,
    failing: failMatch ? parseInt(failMatch[1]) : 0,
    pending: pendingMatch ? parseInt(pendingMatch[1]) : 0
  };
}

async function runTestSuite() {
  printHeader('MilesGuard Test Suite');
  
  const startTime = Date.now();
  const results = {
    unit: {},
    integration: {},
    total: { passing: 0, failing: 0, pending: 0 }
  };

  // Check if dependencies are installed
  printSection('Pre-flight Checks');
  
  if (!fs.existsSync('node_modules')) {
    console.log(colorize('Installing dependencies...', 'yellow'));
    await runCommand('npm install', 'Install dependencies');
  }

  // Unit Tests
  printHeader('Unit Tests');
  
  printSection('Service Tests');
  const serviceResult = await runCommand(
    'NODE_ENV=test npx mocha tests/unit/services/*.test.js --timeout 10000 --reporter json',
    'Running service unit tests',
    { silent: true }
  );
  
  if (serviceResult.success) {
    try {
      const serviceData = JSON.parse(serviceResult.stdout);
      results.unit.services = {
        passing: serviceData.stats.passes,
        failing: serviceData.stats.failures,
        pending: serviceData.stats.pending,
        duration: serviceData.stats.duration
      };
    } catch (e) {
      // Fallback to text parsing
      results.unit.services = extractTestStats(serviceResult.stdout);
    }
  }

  printSection('Model Tests');
  const modelResult = await runCommand(
    'NODE_ENV=test npx mocha tests/unit/models/*.test.js --timeout 10000 --reporter json',
    'Running model unit tests',
    { silent: true }
  );
  
  if (modelResult.success) {
    try {
      const modelData = JSON.parse(modelResult.stdout);
      results.unit.models = {
        passing: modelData.stats.passes,
        failing: modelData.stats.failures,
        pending: modelData.stats.pending,
        duration: modelData.stats.duration
      };
    } catch (e) {
      results.unit.models = extractTestStats(modelResult.stdout);
    }
  }

  printSection('Utility Tests');
  const utilResult = await runCommand(
    'NODE_ENV=test npx mocha tests/unit/utils/*.test.js --timeout 10000 --reporter json',
    'Running utility unit tests',
    { silent: true }
  );
  
  if (utilResult.success) {
    try {
      const utilData = JSON.parse(utilResult.stdout);
      results.unit.utils = {
        passing: utilData.stats.passes,
        failing: utilData.stats.failures,
        pending: utilData.stats.pending,
        duration: utilData.stats.duration
      };
    } catch (e) {
      results.unit.utils = extractTestStats(utilResult.stdout);
    }
  }

  // Integration Tests
  printHeader('Integration Tests');
  
  const integrationResult = await runCommand(
    'NODE_ENV=test npx mocha tests/integration/*.test.js --timeout 15000 --reporter json',
    'Running integration tests',
    { silent: true }
  );
  
  if (integrationResult.success) {
    try {
      const integrationData = JSON.parse(integrationResult.stdout);
      results.integration = {
        passing: integrationData.stats.passes,
        failing: integrationData.stats.failures,
        pending: integrationData.stats.pending,
        duration: integrationData.stats.duration
      };
    } catch (e) {
      results.integration = extractTestStats(integrationResult.stdout);
    }
  }

  // Calculate totals
  Object.values(results.unit).forEach(suite => {
    if (suite.passing) results.total.passing += suite.passing;
    if (suite.failing) results.total.failing += suite.failing;
    if (suite.pending) results.total.pending += suite.pending;
  });
  
  if (results.integration.passing) {
    results.total.passing += results.integration.passing;
    results.total.failing += results.integration.failing;
    results.total.pending += results.integration.pending;
  }

  // Generate Report
  printHeader('Test Results Summary');
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  console.log(colorize('📊 UNIT TESTS:', 'cyan'));
  if (results.unit.services) {
    console.log(`   Services:  ${colorize(results.unit.services.passing + ' passing', 'green')} ${results.unit.services.failing ? colorize(results.unit.services.failing + ' failing', 'red') : ''}`);
  }
  if (results.unit.models) {
    console.log(`   Models:    ${colorize(results.unit.models.passing + ' passing', 'green')} ${results.unit.models.failing ? colorize(results.unit.models.failing + ' failing', 'red') : ''}`);
  }
  if (results.unit.utils) {
    console.log(`   Utils:     ${colorize(results.unit.utils.passing + ' passing', 'green')} ${results.unit.utils.failing ? colorize(results.unit.utils.failing + ' failing', 'red') : ''}`);
  }
  
  console.log(colorize('\n🔗 INTEGRATION TESTS:', 'cyan'));
  if (results.integration.passing) {
    console.log(`   Basic:     ${colorize(results.integration.passing + ' passing', 'green')} ${results.integration.failing ? colorize(results.integration.failing + ' failing', 'red') : ''}`);
  }
  
  console.log(colorize('\n📈 TOTAL RESULTS:', 'magenta'));
  console.log(`   ${colorize('✅ PASSING: ' + results.total.passing, 'green')}`);
  console.log(`   ${colorize('❌ FAILING: ' + results.total.failing, results.total.failing > 0 ? 'red' : 'green')}`);
  console.log(`   ${colorize('⏸️  PENDING: ' + results.total.pending, 'yellow')}`);
  console.log(`   ${colorize('⏱️  DURATION: ' + (totalDuration / 1000).toFixed(2) + 's', 'blue')}`);
  
  // Coverage estimate
  const totalTests = results.total.passing + results.total.failing;
  const successRate = totalTests > 0 ? ((results.total.passing / totalTests) * 100).toFixed(1) : 0;
  
  console.log(`   ${colorize('📊 SUCCESS RATE: ' + successRate + '%', successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red')}`);
  
  // Final status
  console.log('\n' + '='.repeat(60));
  if (results.total.failing === 0) {
    console.log(colorize('🎉 ALL TESTS PASSED! MilesGuard is ready for deployment!', 'green'));
  } else {
    console.log(colorize(`⚠️  ${results.total.failing} tests failing. Review failures before deployment.`, 'red'));
  }
  console.log('='.repeat(60));
  
  // Generate test report file
  const reportData = {
    timestamp: new Date().toISOString(),
    duration: totalDuration,
    results: results,
    summary: {
      total: totalTests,
      passing: results.total.passing,
      failing: results.total.failing,
      pending: results.total.pending,
      successRate: parseFloat(successRate)
    }
  };
  
  fs.writeFileSync('test-results.json', JSON.stringify(reportData, null, 2));
  console.log(colorize('\n📄 Detailed results saved to: test-results.json', 'blue'));
  
  // Exit with appropriate code
  process.exit(results.total.failing > 0 ? 1 : 0);
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'unit':
    console.log(colorize('Running unit tests only...', 'blue'));
    runCommand('NODE_ENV=test npx mocha tests/unit/**/*.test.js --timeout 10000 --reporter spec', 'Unit tests');
    break;
  
  case 'integration':
    console.log(colorize('Running integration tests only...', 'blue'));
    runCommand('NODE_ENV=test npx mocha tests/integration/*.test.js --timeout 15000 --reporter spec', 'Integration tests');
    break;
  
  case 'watch':
    console.log(colorize('Running tests in watch mode...', 'blue'));
    runCommand('NODE_ENV=test npx mocha tests/**/*.test.js --timeout 15000 --reporter spec --watch', 'Watch mode');
    break;
  
  case 'help':
  case '--help':
  case '-h':
    console.log(colorize('MilesGuard Test Runner', 'cyan'));
    console.log('\nUsage:');
    console.log('  npm run test              - Run full test suite');
    console.log('  npm run test unit         - Run unit tests only');
    console.log('  npm run test integration  - Run integration tests only');
    console.log('  npm run test watch        - Run tests in watch mode');
    console.log('  npm run test help         - Show this help');
    break;
  
  default:
    runTestSuite();
}