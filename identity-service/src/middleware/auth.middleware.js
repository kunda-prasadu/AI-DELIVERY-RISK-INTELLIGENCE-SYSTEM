'use strict';

const TokenService = require('../models/token.service');
const UserStore = require('../models/user.store');
const logger = require('./logger');

/**
 * authenticateJWT middleware
 *
 * Validates the Bearer token in the Authorization header.
 * On success: attaches req.user = { id, email, role, permissions }.
 * On failure: 401 Unauthorized.
 *
 * PRD reference: BE-05 — API Gateway secures all traffic via OAuth2/JWT
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = TokenService.verify(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    logger.warn('[Auth] JWT verification failed', { error: err.message, ip: req.ip });
    return res.status(401).json({ error: message });
  }

  // Ensure the user still exists and is active
  UserStore.findById(payload.sub).then((user) => {
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions || [],
    };
    next();
  }).catch((err) => {
    logger.error('[Auth] User lookup failed', { error: err.message });
    res.status(500).json({ error: 'Authentication service error' });
  });
}

module.exports = { authenticateJWT };
