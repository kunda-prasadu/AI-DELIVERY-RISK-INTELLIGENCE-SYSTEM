module.exports = {
  port: process.env.FORECAST_PORT || 3011,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 200,
  // Velocity window in weeks used for trend extrapolation
  velocityWindow: parseInt(process.env.VELOCITY_WINDOW_WEEKS || '4', 10),
  // Sprint capacity assumed (story points per sprint, 2-week sprint)
  defaultSprintCapacity: parseInt(process.env.DEFAULT_SPRINT_CAPACITY || '40', 10),
};
