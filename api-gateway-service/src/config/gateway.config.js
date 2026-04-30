'use strict';

require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isDevelopment = env === 'development';

module.exports = {
  env,
  port: parseInt(process.env.PORT || '3005', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!',
  mfaEnforced: (process.env.GATEWAY_REQUIRE_MFA || 'true') !== 'false',
  services: {
    identity: process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001/auth',
    project: process.env.PROJECT_SERVICE_URL || 'http://localhost:3002/projects',
    observability: process.env.OBSERVABILITY_SERVICE_URL || 'http://localhost:3003',
    metrics: process.env.METRICS_SERVICE_URL || 'http://localhost:3004/metrics',
    reporting: process.env.REPORTING_SERVICE_URL || 'http://localhost:3009/reports',
    feedback: process.env.FEEDBACK_SERVICE_URL || 'http://localhost:3010/feedback',
    forecast: process.env.FORECAST_SERVICE_URL || 'http://localhost:3011/forecasts',
  },
  rateLimit: {
    // Development defaults are intentionally higher with a short window to avoid prolonged local lockouts.
    // Production values should still be provided by environment variables.
    globalWindowMs: parseInt(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || (isDevelopment ? '60000' : '900000'), 10),
    globalMax: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX || (isDevelopment ? '1200' : '300'), 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || (isDevelopment ? '180' : '40'), 10),
    projectsMax: parseInt(process.env.PROJECTS_RATE_LIMIT_MAX || (isDevelopment ? '700' : '120'), 10),
    metricsMax: parseInt(process.env.METRICS_RATE_LIMIT_MAX || (isDevelopment ? '500' : '100'), 10),
    observabilityMax: parseInt(process.env.OBSERVABILITY_RATE_LIMIT_MAX || (isDevelopment ? '900' : '150'), 10),
  },
};
