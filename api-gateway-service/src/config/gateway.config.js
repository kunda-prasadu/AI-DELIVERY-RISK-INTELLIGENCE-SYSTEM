'use strict';

require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3005', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!',
  services: {
    identity: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001/auth',
    project: process.env.PROJECT_SERVICE_URL || 'http://localhost:3002/projects',
    observability: process.env.OBSERVABILITY_SERVICE_URL || 'http://localhost:3003',
    metrics: process.env.METRICS_SERVICE_URL || 'http://localhost:3004/metrics',
  },
  rateLimit: {
    globalWindowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || '900000', 10),
    globalMax: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || '300', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '40', 10),
    projectsMax: parseInt(process.env.PROJECTS_RATE_LIMIT_MAX || '120', 10),
    metricsMax: parseInt(process.env.METRICS_RATE_LIMIT_MAX || '100', 10),
    observabilityMax: parseInt(process.env.OBSERVABILITY_RATE_LIMIT_MAX || '150', 10),
  },
};
