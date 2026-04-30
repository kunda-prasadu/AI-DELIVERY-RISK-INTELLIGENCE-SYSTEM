'use strict';

const TokenService = require('../models/token.service');
const AuditStore = require('../models/audit.store');
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
    AuditStore.record({
      actorId: null,
      actorRole: null,
      action: 'auth.token.verify',
      resourceType: 'session',
      resourceId: null,
      outcome: 'FAILURE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      metadata: { reason: 'missing_or_malformed_header' },
    });
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = TokenService.verify(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    logger.warn('[Auth] JWT verification failed', { error: err.message, ip: req.ip });
    AuditStore.record({
      actorId: null,
      actorRole: null,
      action: 'auth.token.verify',
      resourceType: 'session',
      resourceId: null,
      outcome: 'FAILURE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
      metadata: { reason: message },
    });
    return res.status(401).json({ error: message });
  }

  // Ensure the user still exists and is active
  UserStore.findById(payload.sub).then((user) => {
    if (!user || !user.active) {
      AuditStore.record({
        actorId: payload.sub,
        actorRole: payload.role || null,
        action: 'auth.token.verify',
        resourceType: 'session',
        resourceId: payload.sub,
        outcome: 'FAILURE',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
        metadata: { reason: 'user_not_found_or_inactive' },
      });
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
