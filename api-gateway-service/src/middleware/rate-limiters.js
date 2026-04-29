'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config/gateway.config');

function createLimiter(max, keyGenerator) {
  return rateLimit({
    windowMs: config.rateLimit.globalWindowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: { error: 'Too many requests — slow down' },
  });
}

function getClientKey(req) {
  const userId = req.user?.id || req.user?.sub;
  return userId ? `user:${userId}` : `ip:${req.ip}`;
}

const globalLimiter = createLimiter(config.rateLimit.globalMax, (req) => `global:${req.ip}`);
const authLimiter = createLimiter(config.rateLimit.authMax, (req) => `auth:${req.ip}`);
const projectsLimiter = createLimiter(config.rateLimit.projectsMax, (req) => `projects:${getClientKey(req)}`);
const metricsLimiter = createLimiter(config.rateLimit.metricsMax, (req) => `metrics:${getClientKey(req)}`);
const observabilityLimiter = createLimiter(config.rateLimit.observabilityMax, (req) => `obs:${req.ip}`);

module.exports = {
  globalLimiter,
  authLimiter,
  projectsLimiter,
  metricsLimiter,
  observabilityLimiter,
};
