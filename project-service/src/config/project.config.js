'use strict';

require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),

  jwt: {
    // Must match identity-service secret so tokens issued there are accepted here
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },

  risk: {
    weights: {
      codeVelocity:   parseFloat(process.env.WEIGHT_CODE_VELOCITY   || '0.25'),
      quality:        parseFloat(process.env.WEIGHT_QUALITY          || '0.30'),
      cicd:           parseFloat(process.env.WEIGHT_CICD             || '0.25'),
      jiraVelocity:   parseFloat(process.env.WEIGHT_JIRA_VELOCITY    || '0.20'),
    },
    bands: [
      { label: 'LOW',      min: 0,  max: 25 },
      { label: 'MEDIUM',   min: 26, max: 50 },
      { label: 'HIGH',     min: 51, max: 75 },
      { label: 'CRITICAL', min: 76, max: 100 },
    ],
  },
};
