#!/usr/bin/env node

/**
 * Test script to verify MilesGuard works without Telegram configuration
 */

const fs = require('fs').promises;
const path = require('path');

async function runTest() {
  console.log('🧪 Testing MilesGuard without Telegram configuration...');
  
  try {
    // Copiar o arquivo de configuração de teste
    await fs.copyFile('./test-config-without-telegram.json', './config.json');
    console.log('✅ Config file copied');
    
    // Verificar se o arquivo .env existe e remover as configurações do Telegram
    try {
      let envContent = await fs.readFile('.env', 'utf8');
      envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/g, '# TELEGRAM_BOT_TOKEN=removed_for_test');
      envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/g, '# TELEGRAM_CHAT_ID=removed_for_test');
      await fs.writeFile('.env', envContent, 'utf8');
      console.log('✅ Telegram configuration removed from .env');
    } catch (error) {
      console.log('ℹ️  No .env file found or no Telegram configuration to remove');
    }
    
    console.log('\n✅ Setup complete! You can now run:');
    console.log('   npm start');
    console.log('   or');
    console.log('   node src/index.js');
    console.log('\nThe system should work without Telegram and save messages to local files.');
    
  } catch (error) {
    console.error('❌ Error during test setup:', error.message);
    process.exit(1);
  }
}

runTest();
