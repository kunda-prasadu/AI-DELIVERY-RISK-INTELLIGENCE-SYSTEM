require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config/forecast.config');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/error.handler');
const forecastRoutes = require('./routes/forecast.routes');

const app = express();
app.use(express.json());

app.use(rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'forecast-service' }));
app.get('/ready', (_req, res) => res.json({ status: 'ready' }));

app.use('/forecasts', forecastRoutes);

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    logger.info({ message: `forecast-service listening on port ${config.port}` });
  });
}

module.exports = app;
