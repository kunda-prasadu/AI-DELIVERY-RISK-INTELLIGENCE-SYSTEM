'use strict';

const logger = require('./logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || 500;
  if (status >= 500) {
    logger.error({ msg: 'unhandled.error', error: err.message, stack: err.stack });
  }
  return res.status(status).json({ error: err.message || 'Internal Server Error' });
}

module.exports = errorHandler;
