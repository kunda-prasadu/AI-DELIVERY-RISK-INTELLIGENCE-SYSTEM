'use strict';

require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3004', 10),

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Event consumption from connector framework
  events: {
    pollingIntervalMs: parseInt(process.env.EVENTS_POLLING_INTERVAL_MS || '5000', 10),
    batchSize: parseInt(process.env.EVENTS_BATCH_SIZE || '100', 10),
  },

  // Metrics aggregation windows
  metrics: {
    velocityWindowHours: parseInt(process.env.VELOCITY_WINDOW_HOURS || '24', 10),
    qualityWindowDays: parseInt(process.env.QUALITY_WINDOW_DAYS || '7', 10),
    retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10),
  },

  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
  },
};
