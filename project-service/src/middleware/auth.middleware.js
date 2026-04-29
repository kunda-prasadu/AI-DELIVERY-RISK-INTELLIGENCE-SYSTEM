'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/project.config');

/**
 * Verifies the JWT issued by identity-service.
 * Sets req.user = { id, email, role, permissions } on success.
 */
function authenticateJWT(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
    req.user = {
      id:          payload.sub,
      email:       payload.email,
      role:        payload.role,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }
}

module.exports = { authenticateJWT };
