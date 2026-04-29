'use strict';

require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3003', 10),

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  metrics: {
    retentionSeconds: parseInt(process.env.METRICS_RETENTION_SECONDS || '3600', 10),
  },

  health: {
    timeoutMs: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '5000', 10),
    requiredServices: (process.env.HEALTH_REQUIRED_SERVICES || 'identity-service,project-service')
      .split(',')
      .map(s => s.trim()),
  },
};
