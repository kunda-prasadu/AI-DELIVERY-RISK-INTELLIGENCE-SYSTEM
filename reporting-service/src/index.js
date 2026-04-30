'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config/reporting.config');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/error.handler');
const reportRoutes = require('./routes/report.routes');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  })
);

app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'reporting-service' });
});

app.get('/health/ready', (_req, res) => {
  res.status(200).json({ status: 'ready', service: 'reporting-service' });
});

app.use('/reports', reportRoutes);
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
