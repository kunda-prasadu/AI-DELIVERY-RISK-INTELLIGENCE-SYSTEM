'use strict';

module.exports = {
  port: parseInt(process.env.REPORTING_PORT || '3009', 10),
  rateLimit: {
    windowMs: 60 * 1000,
    max: 100,
  },
  reportRetentionDays: 30,
};
