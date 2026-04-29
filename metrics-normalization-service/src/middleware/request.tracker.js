'use strict';

const logger = require('./logger');

function requestTracker(req, res, next) {
  const start = Date.now();
  const path = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    logger.info({
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs,
      msg: 'request.completed',
    });
  });

  next();
}

module.exports = requestTracker;
