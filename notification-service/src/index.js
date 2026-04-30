'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config/notification.config');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/error.handler');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  })
);

app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'notification-service' });
});

app.get('/health/ready', (_req, res) => {
  res.status(200).json({ status: 'ready', service: 'notification-service' });
});

app.use('/notifications', notificationRoutes);
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info({ msg: 'service.started', port: config.port });
  });

  function shutdown(signal) {
    logger.info({ msg: 'service.stopping', signal });
    server.close(() => {
      logger.info({ msg: 'service.stopped' });
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
