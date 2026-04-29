'use strict';

const { v4: uuidv4 } = require('uuid');
const metricsCollector = require('../models/metrics.collector');
const logger = require('./logger');

/**
 * Middleware that tracks HTTP request metrics and assigns correlation IDs.
 *
 * Adds req.id (correlation ID) and req.startTime for latency calculation.
 */
function requestTracker(req, res, next) {
  req.id = req.headers['x-correlation-id'] || uuidv4();
  req.startTime = Date.now();

  // Store the full path for metrics (before routing modifies req.path)
  const fullPath = req.originalUrl.split('?')[0]; // Remove query string

  // Log incoming request
  logger.info(`[HTTP] ${req.method} ${fullPath}`, {
    correlationId: req.id,
    ip: req.ip,
  });

  // Capture response end
  const originalEnd = res.end;
  res.end = function(...args) {
    const durationMs = Date.now() - req.startTime;
    const status = res.statusCode;

    // Record metrics using the full path
    metricsCollector.recordHttpRequest(req.method, fullPath, status, durationMs);

    // Log response
    logger.info(`[HTTP] ${req.method} ${req.path} → ${status}`, {
      correlationId: req.id,
      durationMs,
    });

    return originalEnd.apply(res, args);
  };

  // Propagate correlation ID in response headers
  res.setHeader('X-Correlation-ID', req.id);

  next();
}

/**
 * Middleware that catches and records errors.
 */
function errorRecorder(err, req, res, next) {
  const errorType = err.name || 'UnknownError';
  metricsCollector.recordError(errorType);

  logger.error(`[Error] ${errorType}`, {
    correlationId: req?.id,
    message: err.message,
    stack: err.stack,
  });

  next(err);
}

module.exports = { requestTracker, errorRecorder };
