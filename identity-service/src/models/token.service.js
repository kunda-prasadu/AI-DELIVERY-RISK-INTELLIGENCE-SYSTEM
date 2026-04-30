'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/identity.config');

/**
 * TokenService — issue, verify, and refresh JWTs.
 *
 * Access token payload:
 *   { sub: userId, email, role, permissions[], iat, exp }
 *
 * Refresh token payload:
 *   { sub: userId, type: 'refresh', iat, exp }
 *
 * PRD reference: BE-05 — role-based access control, OAuth2/JWT
 */
const TokenService = {
  /**
   * Issue an access token for a user.
   * @param {{ id: string, email: string, role: string }} user
   * @param {string[]} permissions
   * @param {{ mfaVerified?: boolean }} options
   * @returns {string}
   */
  issueAccessToken(user, permissions = [], options = {}) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        permissions,
        mfaVerified: options.mfaVerified === true,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' }
    );
  },

  /**
   * Issue a refresh token.
   * @param {string} userId
   * @returns {string}
   */
  issueRefreshToken(userId) {
    return jwt.sign(
      { sub: userId, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn, algorithm: 'HS256' }
    );
  },

  /**
   * Verify and decode a token. Returns payload or throws.
   * @param {string} token
   * @returns {object}
   */
  verify(token) {
    return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  },

  /**
   * Decode without verifying (e.g. for logging expired token claims).
   * @param {string} token
   * @returns {object|null}
   */
  decode(token) {
    return jwt.decode(token);
  },
};

module.exports = TokenService;
