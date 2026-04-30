module.exports = {
  port: process.env.PORT || 4005,
  env: process.env.NODE_ENV || 'development',
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  },
};
