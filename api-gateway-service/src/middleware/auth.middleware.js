'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/gateway.config');

function extractBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith('Bearer ')) return null;
  return headerValue.slice(7).trim();
}

function optionalAuth(req, _res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (_err) {
    req.user = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Missing Bearer token' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  optionalAuth,
  requireAuth,
  extractBearerToken,
};
