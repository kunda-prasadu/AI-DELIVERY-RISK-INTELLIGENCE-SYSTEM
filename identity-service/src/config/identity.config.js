'use strict';

require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },

  mfa: {
    enabled: (process.env.MFA_ENABLED || 'true') === 'true',
    privilegedRoles: (process.env.MFA_PRIVILEGED_ROLES || 'admin,director,program_manager')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean),
    // For local/test baseline; production should replace with a real TOTP/IdP flow.
    testCode: process.env.MFA_TEST_CODE || '123456',
  },
};
