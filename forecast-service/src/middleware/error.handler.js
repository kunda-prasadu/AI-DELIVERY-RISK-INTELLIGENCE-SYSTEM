const logger = require('./logger');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, _req, res, _next) {
  logger.error({ message: err.message, stack: err.stack });
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
};
