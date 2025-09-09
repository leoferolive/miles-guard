const winston = require('winston');
const path = require('path');
const chalkModule = require('chalk');
const chalk = chalkModule.default || chalkModule;
const env = require('../config/environment');

// Ensure logs directory exists
const fs = require('fs');
const logDir = path.dirname(env.LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for console output with colors
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, component, event, data, stack }) => {
    let coloredLevel;
    switch (level) {
      case 'error': coloredLevel = chalk.red.bold('ERROR'); break;
      case 'warn': coloredLevel = chalk.yellow.bold('WARN '); break;
      case 'info': coloredLevel = chalk.blue.bold('INFO '); break;
      case 'debug': coloredLevel = chalk.gray.bold('DEBUG'); break;
      default: coloredLevel = level.toUpperCase();
    }

    let output = `${chalk.gray(timestamp)} ${coloredLevel}`;
    
    if (component) {
      output += ` ${chalk.cyan(`[${component}]`)}`;
    }
    
    if (event) {
      output += ` ${chalk.magenta(event)}`;
    }
    
    output += ` ${message}`;
    
    if (data) {
      try {
        output += `\n${chalk.gray(JSON.stringify(data, null, 2))}`;
      } catch (error) {
        // Handle circular references and non-serializable objects
        output += `\n${chalk.gray('[Complex Object - Unable to stringify]')}`;
      }
    }
    
    if (stack) {
      output += `\n${chalk.red(stack)}`;
    }
    
    return output;
  })
);

// File format for structured logging
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: fileFormat,
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: env.LOG_FILE,
      format: fileFormat
    }),
    
    // Console output with colors
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// Create component-specific loggers
function createComponentLogger(componentName) {
  return {
    error: (message, data = null) => logger.error(message, { component: componentName, data }),
    warn: (message, data = null) => logger.warn(message, { component: componentName, data }),
    info: (message, data = null) => logger.info(message, { component: componentName, data }),
    debug: (message, data = null) => logger.debug(message, { component: componentName, data }),
    
    logEvent: (event, message, data = null) => {
      logger.info(message, { component: componentName, event, data });
    },
    
    logError: (event, error, data = null) => {
      const errorMessage = error?.message || String(error || 'Unknown error');
      const errorStack = error?.stack || null;
      
      logger.error(`${event}: ${errorMessage}`, { 
        component: componentName, 
        event, 
        data,
        stack: errorStack 
      });
    }
  };
}

// Enhanced logging methods for WhatsApp events
const whatsappLogger = createComponentLogger('whatsapp');
whatsappLogger.connection = (status, data) => whatsappLogger.logEvent('connection', `Status: ${status}`, data);
whatsappLogger.message = (groupName, sender, messageLength) => whatsappLogger.logEvent('message', 
  `New message in ${groupName} from ${sender}`, { messageLength });
whatsappLogger.filter = (groupName, matched, keywords) => whatsappLogger.logEvent('filter',
  `Message ${matched ? 'matched' : 'rejected'} in ${groupName}`, { keywords });

// Enhanced logging methods for notifications
const notificationLogger = createComponentLogger('notification');
notificationLogger.sent = (type, target, success) => notificationLogger.logEvent('sent',
  `${type} notification ${success ? 'sent' : 'failed'} to ${target}`);
notificationLogger.queue = (action, count) => notificationLogger.logEvent('queue',
  `${action} notification queue`, { queueSize: count });

// Enhanced logging methods for system events
const systemLogger = createComponentLogger('system');
systemLogger.startup = (data) => systemLogger.logEvent('startup', 'Application starting', data);
systemLogger.shutdown = (data) => systemLogger.logEvent('shutdown', 'Application shutting down', data);
systemLogger.health = (status, metrics) => systemLogger.logEvent('health', `Health check: ${status}`, metrics);

module.exports = {
  logger,
  createComponentLogger,
  whatsappLogger,
  notificationLogger,
  systemLogger
};