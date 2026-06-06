module.exports = {
  apps: [{
    name: 'milesguard',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '200M',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info'
    },
    
    env_development: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      DEBUG_MODE: 'true'
    },
    
    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // Process management
    kill_timeout: 30000,
    wait_ready: true,
    restart_delay: 5000,
    
    // Health monitoring
    health_check_grace_period: 30000,
    health_check_fatal_exceptions: true,
    
    // Advanced PM2 features
    instance_var: 'INSTANCE_ID',
    source_map_support: true,
    
    // Custom settings for WhatsApp connection stability
    node_args: '--max-old-space-size=256',
    
    // Cron restart (optional - restart daily at 3 AM for maintenance)
    cron_restart: env.NODE_ENV === 'production' ? '0 3 * * *' : undefined
  }],

  // Deployment configuration (for future use with servers)
  deploy: {
    production: {
      user: 'milesguard',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/milesguard.git',
      path: '/home/milesguard/milesguard',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};