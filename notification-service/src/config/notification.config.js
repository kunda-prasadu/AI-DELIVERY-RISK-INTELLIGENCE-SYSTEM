module.exports = {
  port: process.env.PORT || 4006,
  env: process.env.NODE_ENV || 'development',
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1200,
  },
};
