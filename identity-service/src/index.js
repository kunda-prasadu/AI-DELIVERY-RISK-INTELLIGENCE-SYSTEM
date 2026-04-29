'use strict';

require('dotenv').config();

const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('./config/identity.config');
const authRoutes = require('./routes/auth.routes');
const UserStore = require('./models/user.store');
const logger = require('./middleware/logger');

const app = express();

// ── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));

// ── Security headers (minimal — no helmet dep for baseline) ──────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down' },
}));

// ── Request logging ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  logger.info(`[HTTP] ${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'identity-service' }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('[Server] Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function start() {
  await UserStore._seedAdmin();

  const server = app.listen(config.port, () => {
    logger.info(`[Server] Identity Service running on port ${config.port}`, { env: config.env });
  });

  const shutdown = (sig) => {
    logger.info(`[Server] ${sig} — shutting down`);
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

module.exports = app; // exported for supertest
