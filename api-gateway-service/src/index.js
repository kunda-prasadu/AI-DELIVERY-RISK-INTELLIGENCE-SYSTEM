'use strict';

const express = require('express');
const config = require('./config/gateway.config');
const logger = require('./middleware/logger');
const requestTracker = require('./middleware/request.tracker');
const errorHandler = require('./middleware/error.handler');
const { optionalAuth, requireAuth } = require('./middleware/auth.middleware');
const {
  globalLimiter,
  authLimiter,
  projectsLimiter,
  metricsLimiter,
  observabilityLimiter,
} = require('./middleware/rate-limiters');
const { createProxyHandler } = require('./routes/proxy.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);
app.use(requestTracker);
app.use(optionalAuth);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'api-gateway-service' });
});

// Route-specific policies
app.use('/api/auth', authLimiter, createProxyHandler(config.services.identity, '/api/auth'));
app.use('/api/projects', requireAuth, projectsLimiter, createProxyHandler(config.services.project, '/api/projects'));
app.use('/api/metrics', requireAuth, metricsLimiter, createProxyHandler(config.services.metrics, '/api/metrics'));
app.use('/api/observability', observabilityLimiter, createProxyHandler(config.services.observability, '/api/observability'));

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info({ msg: 'service.started', port: config.port });
  });

  const shutdown = (signal) => {
    logger.info({ msg: 'service.stopping', signal });
    server.close(() => {
      logger.info({ msg: 'service.stopped' });
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
