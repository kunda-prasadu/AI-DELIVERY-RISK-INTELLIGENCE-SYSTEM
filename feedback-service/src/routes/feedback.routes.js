'use strict';

const express = require('express');
const Joi = require('joi');
const { store, FEEDBACK_TARGETS, FEEDBACK_SIGNALS } = require('../models/feedback.store');
const { aggregateLearningData } = require('../models/learning.engine');

const router = express.Router();

// ── POST /feedback ──────────────────────────────────────────────────────────
// Submit a feedback entry for a recommendation, insight, anomaly, or report.
const submitSchema = Joi.object({
  projectId:      Joi.string().required(),
  targetType:     Joi.string().valid(...FEEDBACK_TARGETS).required(),
  targetId:       Joi.string().required(),
  signal:         Joi.string().valid(...FEEDBACK_SIGNALS).required(),
  submittedBy:    Joi.string().max(80).optional().default('anonymous'),
  comment:        Joi.string().max(500).optional().default(''),
  correctedValue: Joi.any().optional(),
});

router.post('/', (req, res, next) => {
  try {
    const { error, value } = submitSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 400;
      return next(err);
    }
    const record = store.save(value);
    return res.status(201).json({ feedback: record });
  } catch (err) {
    return next(err);
  }
});

// ── GET /feedback ───────────────────────────────────────────────────────────
// List feedback entries with optional ?targetType=, ?targetId=, ?signal=, ?projectId= filters.
router.get('/', (req, res) => {
  const entries = store.list({
    targetType: req.query.targetType,
    targetId:   req.query.targetId,
    signal:     req.query.signal,
    projectId:  req.query.projectId,
  });
  return res.status(200).json({ feedback: entries, total: entries.length });
});

// ── GET /feedback/learning ──────────────────────────────────────────────────
// Return aggregated learning signals, optionally scoped to ?projectId=.
router.get('/learning', (req, res) => {
  const entries = store.list({ projectId: req.query.projectId });
  const summary = aggregateLearningData(entries);
  return res.status(200).json({ learning: summary });
});

// ── GET /feedback/:feedbackId ───────────────────────────────────────────────
router.get('/:feedbackId', (req, res, next) => {
  const record = store.findById(req.params.feedbackId);
  if (!record) {
    const err = new Error('Feedback entry not found');
    err.statusCode = 404;
    return next(err);
  }
  return res.status(200).json({ feedback: record });
});

module.exports = router;
