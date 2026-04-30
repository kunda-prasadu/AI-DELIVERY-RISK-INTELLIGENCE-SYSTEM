const logger = require('./logger');

module.exports = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    msg: 'error.handler',
    statusCode,
    message,
    stack: err.stack,
  });

  res.status(statusCode).json({
    error: message,
    statusCode,
  });
};
