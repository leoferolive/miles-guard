const fs = require('fs').promises;
const path = require('path');

/**
 * Cleanup utilities for tests
 */

class TestCleanup {
  constructor() {
    this.filesToCleanup = new Set();
    this.directoriesToCleanup = new Set();
    this.processesToKill = new Set();
  }
  
  // Register a file for cleanup
  registerFile(filePath) {
    this.filesToCleanup.add(path.resolve(filePath));
  }
  
  // Register a directory for cleanup
  registerDirectory(dirPath) {
    this.directoriesToCleanup.add(path.resolve(dirPath));
  }
  
  // Register a process for cleanup (for integration tests)
  registerProcess(pid) {
    this.processesToKill.add(pid);
  }
  
  // Clean up all registered files
  async cleanupFiles() {
    const promises = Array.from(this.filesToCleanup).map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore if file doesn't exist
        if (error.code !== 'ENOENT') {
          console.warn(`Warning: Could not cleanup file ${filePath}:`, error.message);
        }
      }
    });
    
    await Promise.all(promises);
    this.filesToCleanup.clear();
  }
  
  // Clean up all registered directories
  async cleanupDirectories() {
    const promises = Array.from(this.directoriesToCleanup).map(async (dirPath) => {
      try {
        await fs.rm(dirPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore if directory doesn't exist
        if (error.code !== 'ENOENT') {
          console.warn(`Warning: Could not cleanup directory ${dirPath}:`, error.message);
        }
      }
    });
    
    await Promise.all(promises);
    this.directoriesToCleanup.clear();
  }
  
  // Kill all registered processes
  async cleanupProcesses() {
    this.processesToKill.forEach(pid => {
      try {
        process.kill(pid, 'SIGTERM');
      } catch (error) {
        // Ignore if process doesn't exist
        if (error.code !== 'ESRCH') {
          console.warn(`Warning: Could not kill process ${pid}:`, error.message);
        }
      }
    });
    
    this.processesToKill.clear();
  }
  
  // Clean up everything
  async cleanupAll() {
    await Promise.all([
      this.cleanupFiles(),
      this.cleanupDirectories(),
      this.cleanupProcesses()
    ]);
  }
  
  // Reset cleanup registry
  reset() {
    this.filesToCleanup.clear();
    this.directoriesToCleanup.clear();
    this.processesToKill.clear();
  }
}

// Global cleanup instance
const globalCleanup = new TestCleanup();

// Utility functions for specific cleanup tasks
const cleanupUtils = {
  // Clean up WhatsApp auth files
  async cleanupWhatsAppAuth(authPath = './test_auth_info') {
    try {
      await fs.rm(authPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  },
  
  // Clean up log files
  async cleanupLogs(logsPath = './test_logs') {
    try {
      await fs.rm(logsPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  },
  
  // Clean up config files
  async cleanupConfigs(configPaths = ['./test_config.json']) {
    const promises = configPaths.map(async (configPath) => {
      try {
        await fs.unlink(configPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    
    await Promise.all(promises);
  },
  
  // Clean up coverage files
  async cleanupCoverage() {
    try {
      await fs.rm('./coverage', { recursive: true, force: true });
      await fs.rm('./.nyc_output', { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  },
  
  // Clean up temporary test data
  async cleanupTempData(tempPath = './temp_test_data') {
    try {
      await fs.rm(tempPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  },
  
  // Complete cleanup for all test artifacts
  async cleanupAllTestArtifacts() {
    await Promise.all([
      cleanupUtils.cleanupWhatsAppAuth(),
      cleanupUtils.cleanupLogs(),
      cleanupUtils.cleanupConfigs(),
      cleanupUtils.cleanupCoverage(),
      cleanupUtils.cleanupTempData()
    ]);
  }
};

// Setup cleanup hooks for process exit
process.on('exit', () => {
  // Synchronous cleanup on exit
  globalCleanup.processesToKill.forEach(pid => {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (error) {
      // Ignore errors on exit
    }
  });
});

process.on('SIGINT', async () => {
  await globalCleanup.cleanupAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await globalCleanup.cleanupAll();
  process.exit(0);
});

module.exports = {
  TestCleanup,
  globalCleanup,
  cleanupUtils
};