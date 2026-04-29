'use strict';

const express = require('express');
const { normalizeBatch } = require('../models/event.normalizer');
const aggregator = require('../models/metrics.aggregator');
const orchestrator = require('../models/pipeline.orchestrator');
const { analyzeProjectTrend } = require('../models/trend.analyzer');

const router = express.Router();

router.post('/events', (req, res) => {
  const input = Array.isArray(req.body?.events) ? req.body.events : [];
  const { accepted, rejected } = normalizeBatch(input);
  aggregator.ingestBatch(accepted);

  res.status(200).json({
    received: input.length,
    accepted: accepted.length,
    rejected: rejected.length,
    rejectedItems: rejected,
  });
});

router.get('/projects/:projectId', (req, res) => {
  const metrics = aggregator.getProjectMetrics(req.params.projectId);
  if (!metrics) return res.status(404).json({ error: 'Project metrics not found' });
  return res.status(200).json(metrics);
});

router.get('/projects/:projectId/trend', (req, res) => {
  const current = aggregator.getProjectMetrics(req.params.projectId);
  if (!current) return res.status(404).json({ error: 'Project metrics not found' });

  const previous = orchestrator.getPreviousMetrics(req.params.projectId);
  return res.status(200).json(analyzeProjectTrend(current, previous));
});

router.get('/projects', (_req, res) => {
  res.status(200).json(aggregator.listProjectMetrics());
});

router.get('/summary', (_req, res) => {
  res.status(200).json(aggregator.summary());
});

module.exports = router;
