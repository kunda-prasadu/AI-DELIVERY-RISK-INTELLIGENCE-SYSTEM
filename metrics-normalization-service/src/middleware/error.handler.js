'use strict';

const logger = require('./logger');

function errorHandler(err, _req, res, _next) {
  logger.error({ msg: 'request.failed', error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
}

module.exports = errorHandler;
