'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config/metrics.config');
const logger = require('./middleware/logger');
const requestTracker = require('./middleware/request.tracker');
const errorHandler = require('./middleware/error.handler');
const metricsRoutes = require('./routes/metrics.routes');
const orchestrator = require('./models/pipeline.orchestrator');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  })
);
app.use(requestTracker);

app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'metrics-normalization-service' });
});

app.get('/health/ready', (_req, res) => {
  res.status(200).json({
    status: orchestrator.isRunning() ? 'ready' : 'degraded',
    pipelineRunning: orchestrator.isRunning(),
  });
});

app.use('/metrics', metricsRoutes);
app.use(errorHandler);

if (require.main === module) {
  const server = app.listen(config.port, () => {
    orchestrator.start();
    logger.info({ msg: 'service.started', port: config.port });
  });

  function shutdown(signal) {
    logger.info({ msg: 'service.stopping', signal });
    orchestrator.stop();
    server.close(() => {
      logger.info({ msg: 'service.stopped' });
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = app;
