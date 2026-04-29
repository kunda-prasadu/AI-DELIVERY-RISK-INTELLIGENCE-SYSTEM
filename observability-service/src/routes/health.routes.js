'use strict';

const express = require('express');
const healthChecker = require('../models/health.checker');
const metricsCollector = require('../models/metrics.collector');
const logger = require('../middleware/logger');

const router = express.Router();

// ── GET /health/live ───────────────────────────────────────────────────────
/**
 * Liveness probe — always returns 200 if process is running.
 * Used by orchestration (Kubernetes, Docker, etc.) to restart unhealthy instances.
 */
router.get('/live', async (req, res) => {
  const result = await healthChecker.liveness();
  res.status(200).json(result);
});

// ── GET /health/ready ──────────────────────────────────────────────────────
/**
 * Readiness probe — returns 200 only if all critical dependencies are healthy.
 * Used by orchestration to route traffic only to ready instances.
 */
router.get('/ready', async (req, res) => {
  const result = await healthChecker.readiness();
  const statusCode = result.ready ? 200 : 503;
  res.status(statusCode).json(result);
});

// ── GET /health/detailed ───────────────────────────────────────────────────
/**
 * Detailed health report with all checks.
 */
router.get('/detailed', async (req, res) => {
  const checks = await healthChecker.runAll();
  res.status(200).json(checks);
});

// ── GET /metrics ───────────────────────────────────────────────────────────
/**
 * Export metrics in Prometheus text format.
 * Consumed by Prometheus scraper or metrics visualization tools.
 */
router.get('/metrics', (req, res) => {
  const prometheusOutput = metricsCollector.exportPrometheus();
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.status(200).send(prometheusOutput);
});

// ── GET /metrics/summary ───────────────────────────────────────────────────
/**
 * Quick JSON summary of key metrics.
 */
router.get('/metrics/summary', (req, res) => {
  const summary = metricsCollector.getSummary();
  res.status(200).json(summary);
});

module.exports = router;
