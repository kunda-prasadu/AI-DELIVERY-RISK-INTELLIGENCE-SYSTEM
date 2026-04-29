'use strict';

const { createLogger, format, transports } = require('winston');
const config = require('../config/gateway.config');

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'api-gateway-service' },
  transports: [new transports.Console()],
});

module.exports = logger;
