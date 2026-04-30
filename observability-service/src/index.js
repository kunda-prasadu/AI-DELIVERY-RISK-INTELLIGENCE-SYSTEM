'use strict';

require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config/obs.config');
const healthRoutes = require('./routes/health.routes');
const { requestTracker, errorRecorder } = require('./middleware/request.tracker');
const logger = require('./middleware/logger');
const metricsCollector = require('./models/metrics.collector');

const app = express();

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));

// ── Security headers ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Global rate limiter ──────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // permissive for internal monitoring
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
}));

// ── Request tracking ─────────────────────────────────────────────────────────
app.use(requestTracker);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);

// Also expose metrics at top level for convenience
app.get('/metrics', (req, res) => {
  const prometheusOutput = metricsCollector.exportPrometheus();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(prometheusOutput);
});

app.get('/metrics/summary', (req, res) => {
  const summary = metricsCollector.getSummary();
  res.status(200).json(summary);
});

app.get('/metrics/slo', (req, res) => {
  const summary = metricsCollector.getSloSummary();
  res.status(200).json(summary);
});

app.post('/metrics/frontend', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload.route !== 'string' || !payload.route.trim() || typeof payload.durationMs !== 'number' || Number.isNaN(payload.durationMs) || payload.durationMs < 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: ['"route" is required', '"durationMs" must be a non-negative number'].filter((message) => {
        if (message.includes('route')) {
          return !payload || typeof payload.route !== 'string' || !payload.route.trim();
        }

        return !payload || typeof payload.durationMs !== 'number' || Number.isNaN(payload.durationMs) || payload.durationMs < 0;
      }),
    });
  }

  metricsCollector.recordDashboardRender(payload.route.trim(), payload.durationMs);
  res.status(202).json({ accepted: true });
});

// ── Status endpoint ──────────────────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ status: 'ok', service: 'observability-service' }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ────────────────────────────────────────────────────────────
app.use(errorRecorder);
app.use((err, _req, res, _next) => {
  logger.error('[Server] Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
if (require.main === module) {
  const server = app.listen(config.port, () => {
    logger.info(`[Server] Observability Service running on port ${config.port}`, { env: config.env });
  });

  const shutdown = (sig) => {
    logger.info(`[Server] ${sig} — shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app; // exported for supertest
