'use strict';

const express = require('express');
const { normalizeBatch } = require('../models/event.normalizer');
const aggregator = require('../models/metrics.aggregator');
const orchestrator = require('../models/pipeline.orchestrator');
const { analyzeProjectTrend } = require('../models/trend.analyzer');
const { classifyProjectAnomaly, classifyPortfolioAnomalies } = require('../models/anomaly.classifier');
const { buildRiskTrend } = require('../models/risk.trend.calculator');
const { evaluateProjectAlerts, evaluatePortfolioAlerts } = require('../models/alert.threshold.engine');

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

router.get('/projects/:projectId/anomalies', (req, res) => {
  const current = aggregator.getProjectMetrics(req.params.projectId);
  if (!current) return res.status(404).json({ error: 'Project metrics not found' });

  const previous = orchestrator.getPreviousMetrics(req.params.projectId);
  return res.status(200).json(classifyProjectAnomaly(current, previous));
});

router.get('/projects/:projectId/risk-trend', (req, res) => {
  const history = orchestrator.getSnapshotHistory(req.params.projectId);
  if (!history.length) return res.status(404).json({ error: 'No snapshot history found for project' });
  return res.status(200).json(buildRiskTrend(req.params.projectId, history));
});

router.get('/projects/:projectId/alerts', (req, res) => {
  const metrics = aggregator.getProjectMetrics(req.params.projectId);
  if (!metrics) return res.status(404).json({ error: 'Project metrics not found' });
  const history = orchestrator.getSnapshotHistory(req.params.projectId);
  const trend = history.length ? buildRiskTrend(req.params.projectId, history) : null;
  return res.status(200).json(evaluateProjectAlerts(metrics, trend));
});

router.get('/projects', (_req, res) => {
  res.status(200).json(aggregator.listProjectMetrics());
});

router.get('/anomalies', (_req, res) => {
  const anomalies = classifyPortfolioAnomalies(
    aggregator.listProjectMetrics(),
    (projectId) => orchestrator.getPreviousMetrics(projectId)
  );

  return res.status(200).json({
    totalProjects: anomalies.length,
    anomalies,
  });
});

router.get('/alerts', (_req, res) => {
  const allMetrics = aggregator.listProjectMetrics();
  const alerts = evaluatePortfolioAlerts(
    allMetrics,
    (projectId) => {
      const history = orchestrator.getSnapshotHistory(projectId);
      return history.length ? buildRiskTrend(projectId, history) : null;
    }
  );
  return res.status(200).json({
    totalActive: alerts.length,
    alerts,
  });
});

router.get('/summary', (_req, res) => {
  res.status(200).json(aggregator.summary());
});

module.exports = router;
