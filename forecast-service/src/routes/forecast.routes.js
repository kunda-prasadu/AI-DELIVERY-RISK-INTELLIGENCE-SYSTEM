const express = require('express');
const Joi = require('joi');
const { generateForecast, FORECAST_TYPES } = require('../models/forecast.engine');
const { store } = require('../models/forecast.store');

const router = express.Router();

// ── Shared Joi schemas ────────────────────────────────────────────────────────

const riskHistoryEntrySchema = Joi.object({
  date: Joi.string().required(),
  score: Joi.number().min(0).max(100).required(),
});

const completionPayloadSchema = Joi.object({
  forecastType: Joi.string().valid(FORECAST_TYPES.COMPLETION).required(),
  projectId: Joi.string().required(),
  projectName: Joi.string().optional(),
  remainingPoints: Joi.number().min(0).required(),
  sprintVelocities: Joi.array().items(Joi.number().min(0)).min(1).required(),
  sprintLengthDays: Joi.number().min(1).optional(),
});

const riskTrendPayloadSchema = Joi.object({
  forecastType: Joi.string().valid(FORECAST_TYPES.RISK_TREND).required(),
  projectId: Joi.string().required(),
  projectName: Joi.string().optional(),
  riskHistory: Joi.array().items(riskHistoryEntrySchema).min(1).required(),
  weeksAhead: Joi.number().min(1).max(52).optional(),
});

const velocityPayloadSchema = Joi.object({
  forecastType: Joi.string().valid(FORECAST_TYPES.VELOCITY).required(),
  projectId: Joi.string().required(),
  projectName: Joi.string().optional(),
  sprintVelocities: Joi.array().items(Joi.number().min(0)).min(1).required(),
  sprintsAhead: Joi.number().min(1).max(26).optional(),
});

const projectEntrySchema = Joi.object({
  projectId: Joi.string().required(),
  projectName: Joi.string().optional(),
  remainingPoints: Joi.number().min(0).optional(),
  sprintVelocities: Joi.array().items(Joi.number().min(0)).optional(),
  sprintLengthDays: Joi.number().min(1).optional(),
  riskHistory: Joi.array().items(riskHistoryEntrySchema).optional(),
  weeksAhead: Joi.number().min(1).max(52).optional(),
});

const portfolioPayloadSchema = Joi.object({
  forecastType: Joi.string().valid(FORECAST_TYPES.PORTFOLIO).required(),
  projects: Joi.array().items(projectEntrySchema).min(1).required(),
});

function selectSchema(forecastType) {
  switch (forecastType) {
    case FORECAST_TYPES.COMPLETION: return completionPayloadSchema;
    case FORECAST_TYPES.RISK_TREND: return riskTrendPayloadSchema;
    case FORECAST_TYPES.VELOCITY: return velocityPayloadSchema;
    case FORECAST_TYPES.PORTFOLIO: return portfolioPayloadSchema;
    default: return null;
  }
}

// ── POST /forecasts/generate ──────────────────────────────────────────────────

router.post('/generate', (req, res, next) => {
  try {
    const { forecastType } = req.body;
    const schema = selectSchema(forecastType);
    if (!schema) {
      return res.status(400).json({ error: `Unknown forecastType: ${forecastType}` });
    }
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(422).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
    }

    const forecast = generateForecast(value);
    const saved = store.save(forecast);
    return res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

// ── GET /forecasts ────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { forecastType, projectId } = req.query;
  const results = store.list({ forecastType, projectId });
  res.json({ forecasts: results, total: results.length });
});

// ── GET /forecasts/:forecastId ────────────────────────────────────────────────

router.get('/:forecastId', (req, res) => {
  const { forecastId } = req.params;
  const entry = store.findById(forecastId);
  if (!entry) {
    return res.status(404).json({ error: `Forecast ${forecastId} not found` });
  }
  return res.json(entry);
});

module.exports = router;
