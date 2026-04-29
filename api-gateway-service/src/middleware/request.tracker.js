'use strict';

const logger = require('./logger');

function requestTracker(req, res, next) {
  const start = Date.now();
  const path = req.originalUrl.split('?')[0];

  res.on('finish', () => {
    logger.info({
      msg: 'request.completed',
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });

  next();
}

module.exports = requestTracker;
