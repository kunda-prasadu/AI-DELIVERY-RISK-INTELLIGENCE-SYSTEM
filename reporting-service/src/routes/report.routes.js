'use strict';

const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const engine = require('../models/report.engine');
const store = require('../models/report.store');

const router = express.Router();

// ── POST /reports/generate ──────────────────────────────────────────────────
// Generate an executive report on demand.
const generateSchema = Joi.object({
  reportType: Joi.string()
    .valid(...engine.REPORT_TYPES)
    .default('executive-summary'),
  requestedBy: Joi.string().max(80).optional().default('system'),
  projects: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        riskScore: Joi.number().min(0).max(100).optional().default(0),
        status: Joi.string().optional().default('active'),
      })
    )
    .optional()
    .default([]),
  openInsights: Joi.number().integer().min(0).optional().default(0),
  openRecommendations: Joi.number().integer().min(0).optional().default(0),
  anomalyCount: Joi.number().integer().min(0).optional().default(0),
});

router.post('/generate', (req, res, next) => {
  try {
    const { error, value } = generateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 400;
      return next(err);
    }

    const report = engine.generateReport(value);
    const saved = store.save(report);
    return res.status(201).json({ report: saved });
  } catch (err) {
    return next(err);
  }
});

// ── GET /reports ────────────────────────────────────────────────────────────
// List all generated reports with optional ?reportType= and ?requestedBy= filters.
router.get('/', (req, res) => {
  const reports = store.list({
    reportType: req.query.reportType,
    requestedBy: req.query.requestedBy,
  });
  return res.status(200).json({ reports, total: reports.length });
});

// ── GET /reports/:reportId ──────────────────────────────────────────────────
// Retrieve a specific report by ID.
router.get('/:reportId', (req, res, next) => {
  const report = store.findById(req.params.reportId);
  if (!report) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    return next(err);
  }
  return res.status(200).json({ report });
});

// ── GET /reports/:reportId/markdown ────────────────────────────────────────
// Return the rendered markdown for a specific report.
router.get('/:reportId/markdown', (req, res, next) => {
  const report = store.findById(req.params.reportId);
  if (!report) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    return next(err);
  }
  res.setHeader('Content-Type', 'text/markdown');
  return res.status(200).send(report.markdown || '');
});

module.exports = router;
