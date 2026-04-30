'use strict';

const express = require('express');
const Joi = require('joi');
const ProjectStore = require('../models/project.store');
const EventStore = require('../models/event.store');
const RiskEngine = require('../models/risk.engine');
const InsightsEngine = require('../models/insights.engine');
const RecommendationEngine = require('../models/recommendation.engine');
const { authenticateJWT } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/rbac.middleware');
const logger = require('../middleware/logger');

const router = express.Router();

// All project routes require authentication
router.use(authenticateJWT);

// ── Validation ─────────────────────────────────────────────────────────────

const createProjectSchema = Joi.object({
  name:        Joi.string().min(3).max(120).required(),
  description: Joi.string().max(500).optional().default(''),
  status:      Joi.string().valid(...ProjectStore.STATUSES).optional(),
  team:        Joi.string().min(2).max(60).required(),
  startDate:   Joi.string().isoDate().optional(),
  targetDate:  Joi.string().isoDate().optional().allow(null),
  metadata:    Joi.object().optional().default({}),
});

const filterSchema = Joi.object({
  status: Joi.string().valid(...ProjectStore.STATUSES).optional(),
  team:   Joi.string().optional(),
});

// ── GET /projects ──────────────────────────────────────────────────────────
/**
 * List all projects.
 * Permission: projects:read
 * Supports ?status= and ?team= query filters.
 */
router.get('/', requirePermission('projects:read'), (req, res) => {
  const { error, value } = filterSchema.validate(req.query, { stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: 'Invalid filter parameters', details: error.details.map(d => d.message) });
  }

  const projects = ProjectStore.listAll(value);
  logger.info('[Projects] List requested', { userId: req.user.id, count: projects.length, filters: value });
  return res.status(200).json({ projects, total: projects.length });
});

// ── GET /projects/:id ──────────────────────────────────────────────────────
/**
 * Get a single project by ID.
 * Permission: projects:read
 */
router.get('/:id', requirePermission('projects:read'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  return res.status(200).json({ project });
});

// ── GET /projects/:id/risk-score ───────────────────────────────────────────
/**
 * Compute and return the risk score for a project.
 * Permission: risk:read
 */
router.get('/:id/risk-score', requirePermission('risk:read'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const riskScore = RiskEngine.computeScore(req.params.id);
  logger.info('[RiskScore] Computed', {
    userId: req.user.id,
    projectId: req.params.id,
    score: riskScore.score,
    band: riskScore.band,
  });
  return res.status(200).json({ riskScore });
});

// ── GET /projects/:id/insights ─────────────────────────────────────────────
/**
 * Return AI-style actionable insights based on risk signals.
 * Permission: risk:read
 * Query params: ?severity=INFO|WARNING|CRITICAL, ?domain=..., ?page=1, ?limit=10
 */
router.get('/:id/insights', requirePermission('risk:read'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const riskScore = RiskEngine.computeScore(req.params.id);
  let insights  = InsightsEngine.generateInsights(req.params.id, riskScore.signals, riskScore.band);

  // Filter by severity if provided
  const severity = req.query.severity;
  if (severity) {
    insights = insights.filter(i => i.severity === severity);
  }

  // Filter by domain if provided
  const domain = req.query.domain;
  if (domain) {
    insights = insights.filter(i => i.domain === domain);
  }

  // Pagination
  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || 10, 10)));
  const start = (page - 1) * limit;
  const total = insights.length;
  const paged = insights.slice(start, start + limit);

  logger.info('[Insights] Generated', {
    userId: req.user.id,
    projectId: req.params.id,
    insightCount: paged.length,
    total,
    band: riskScore.band,
    filters: { severity, domain, page, limit },
  });

  return res.status(200).json({
    projectId:  req.params.id,
    riskScore:  riskScore.score,
    band:       riskScore.band,
    insights:   paged,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    generatedAt: new Date().toISOString(),
  });
});

// ── GET /projects/:id/insights/summary ──────────────────────────────────────
/**
 * Return summary stats of insights for a project (counts by severity/domain).
 * Permission: risk:read
 */
router.get('/:id/insights/summary', requirePermission('risk:read'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const riskScore = RiskEngine.computeScore(req.params.id);
  const insights  = InsightsEngine.generateInsights(req.params.id, riskScore.signals, riskScore.band);

  // Calculate counts
  const severityCounts = { INFO: 0, WARNING: 0, CRITICAL: 0 };
  const domainCounts = {};
  insights.forEach(i => {
    if (severityCounts.hasOwnProperty(i.severity)) severityCounts[i.severity] += 1;
    domainCounts[i.domain] = (domainCounts[i.domain] || 0) + 1;
  });

  logger.info('[InsightsSummary] Generated', {
    userId: req.user.id,
    projectId: req.params.id,
    totalInsights: insights.length,
  });

  return res.status(200).json({
    projectId:  req.params.id,
    riskScore:  riskScore.score,
    band:       riskScore.band,
    totalInsights: insights.length,
    severityCounts,
    domainCounts,
    generatedAt: new Date().toISOString(),
  });
});

// ── GET /projects/:id/recommendations ──────────────────────────────────────
/**
 * Return prioritized recommendations generated from project insights.
 * Permission: risk:read
 * Query params: ?priority=P1|P2|P3, ?domain=..., ?ownerRole=..., ?page=1, ?limit=10
 */
router.get('/:id/recommendations', requirePermission('risk:read'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const riskScore = RiskEngine.computeScore(req.params.id);
  const insights = InsightsEngine.generateInsights(req.params.id, riskScore.signals, riskScore.band);
  let recommendations = RecommendationEngine.generateRecommendations(req.params.id, riskScore, insights);

  const priority = req.query.priority;
  if (priority) {
    recommendations = recommendations.filter(r => r.priority === priority);
  }

  const domain = req.query.domain;
  if (domain) {
    recommendations = recommendations.filter(r => r.domain === domain);
  }

  const ownerRole = req.query.ownerRole;
  if (ownerRole) {
    recommendations = recommendations.filter(r => r.ownerRole === ownerRole);
  }

  const page = Math.max(1, parseInt(req.query.page || 1, 10));
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || 10, 10)));
  const start = (page - 1) * limit;
  const total = recommendations.length;
  const paged = recommendations.slice(start, start + limit);

  logger.info('[Recommendations] Generated', {
    userId: req.user.id,
    projectId: req.params.id,
    recommendationCount: paged.length,
    total,
    filters: { priority, domain, ownerRole, page, limit },
  });

  return res.status(200).json({
    projectId: req.params.id,
    riskScore: riskScore.score,
    band: riskScore.band,
    recommendations: paged,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    generatedAt: new Date().toISOString(),
  });
});

// ── GET /projects/:id/recommendations/summary ─────────────────────────────
/**
 * Return summary stats of generated recommendations.
 * Permission: risk:read
 */
router.get('/:id/recommendations/summary', requirePermission('risk:read'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const riskScore = RiskEngine.computeScore(req.params.id);
  const insights = InsightsEngine.generateInsights(req.params.id, riskScore.signals, riskScore.band);
  const recommendations = RecommendationEngine.generateRecommendations(req.params.id, riskScore, insights);
  const summary = RecommendationEngine.summarizeRecommendations(recommendations);

  logger.info('[RecommendationsSummary] Generated', {
    userId: req.user.id,
    projectId: req.params.id,
    totalRecommendations: summary.totalRecommendations,
  });

  return res.status(200).json({
    projectId: req.params.id,
    riskScore: riskScore.score,
    band: riskScore.band,
    ...summary,
    generatedAt: new Date().toISOString(),
  });
});

// ── POST /projects ─────────────────────────────────────────────────────────
/**
 * Create a new project.
 * Permission: projects:write
 */
router.post('/', requirePermission('projects:write'), (req, res) => {
  const { error, value } = createProjectSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
  }

  try {
    const project = ProjectStore.create(value);
    logger.info('[Projects] Created', { userId: req.user.id, projectId: project.id });
    return res.status(201).json({ project });
  } catch (err) {
    if (err.code === 'INVALID_STATUS') return res.status(400).json({ error: err.message });
    logger.error('[Projects] Create failed', { error: err.message });
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// ── POST /projects/:id/events ──────────────────────────────────────────────
/**
 * Ingest a NormalizedEvent for a project (called by connector-framework / internal services).
 * Permission: events:write
 */
router.post('/:id/events', requirePermission('events:write'), (req, res) => {
  const project = ProjectStore.findById(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const event = {
    ...req.body,
    projectId: req.params.id,
    receivedAt: new Date().toISOString(),
  };

  EventStore.push(event);
  logger.info('[Events] Ingested', { userId: req.user.id, projectId: req.params.id, eventType: event.eventType });
  return res.status(202).json({ message: 'Event accepted', eventId: event.id });
});

module.exports = router;
