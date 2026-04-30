'use strict';

module.exports = {
  port: parseInt(process.env.FEEDBACK_PORT || '3010', 10),
  rateLimit: {
    windowMs: 60 * 1000,
    max: 200,
  },
};
