'use strict';

const express = require('express');
const Joi = require('joi');
const logger = require('../middleware/logger');
const { buildForwardHeaders, forwardRequest } = require('./proxy.routes');

const router = express.Router();

const querySchema = Joi.object({
  insightLimit: Joi.number().integer().min(1).max(10).optional().default(3),
  recommendationLimit: Joi.number().integer().min(1).max(10).optional().default(3),
});

function mergeAgent(workbench, key, patch) {
  const current = Array.isArray(workbench.agents) ? workbench.agents : [];
  const index = current.findIndex((agent) => agent.key === key);

  if (index === -1) {
    current.push({ key, ...patch });
    workbench.agents = current;
    return;
  }

  current[index] = {
    ...current[index],
    ...patch,
    summary: {
      ...(current[index].summary || {}),
      ...(patch.summary || {}),
    },
  };
}

async function fetchService({ method, targetBase, path, headers, query }) {
  try {
    const response = await forwardRequest({ method, targetBase, path, headers, query });
    if (response.status >= 400) {
      return { ok: false, status: response.status, data: response.data };
    }

    return { ok: true, status: response.status, data: response.data };
  } catch (error) {
    return {
      ok: false,
      status: error.response?.status || 502,
      data: error.response?.data || { error: error.message },
    };
  }
}

function buildSourceStatus(response) {
  return response.ok ? 'connected' : 'degraded';
}

function enrichWorkbench(workbench, dependencies) {
  const feedbackLearning = dependencies.feedback.ok ? dependencies.feedback.data.learning : null;
  const latestReport = dependencies.reporting.ok ? dependencies.reporting.data.reports?.[0] || null : null;
  const latestForecast = dependencies.forecast.ok ? dependencies.forecast.data.forecasts?.[0] || null : null;

  if (feedbackLearning) {
    mergeAgent(workbench, 'feedback-learning', {
      status: feedbackLearning.total > 0 ? 'ACTIVE' : 'READY',
      summary: {
        totalFeedback: feedbackLearning.total,
        acceptanceRate: `${feedbackLearning.acceptanceRate}%`,
        rejectedTargets: feedbackLearning.topRejected.length,
      },
    });
  }

  if (latestForecast) {
    mergeAgent(workbench, 'prediction', {
      name: 'Prediction Agent',
      status: 'ACTIVE',
      summary: {
        forecastType: latestForecast.forecastType,
        atRiskCount: latestForecast.summary?.atRiskCount || 0,
        worseningCount: latestForecast.summary?.worseningCount || 0,
      },
    });
  }

  if (latestReport) {
    mergeAgent(workbench, 'reporting', {
      name: 'Reporting Agent',
      status: 'ACTIVE',
      summary: {
        reportType: latestReport.reportType,
        overallRag: latestReport.sections?.executiveSummary?.overallRag || 'UNKNOWN',
        openRecommendations: latestReport.sections?.executiveSummary?.openRecommendations || 0,
      },
    });
  }

  workbench.serviceStatus = {
    core: 'connected',
    feedback: buildSourceStatus(dependencies.feedback),
    reporting: buildSourceStatus(dependencies.reporting),
    forecasting: buildSourceStatus(dependencies.forecast),
  };
  workbench.feedbackLearning = feedbackLearning;
  workbench.latestReport = latestReport;
  workbench.latestForecast = latestForecast;

  return workbench;
}

function createAgentRouter(services) {
  router.get('/projects/:projectId/workbench', async (req, res, next) => {
    try {
      const { error, value } = querySchema.validate(req.query, { stripUnknown: true });
      if (error) {
        return res.status(400).json({
          error: 'Invalid agent query',
          details: error.details.map((detail) => detail.message),
        });
      }

      const headers = buildForwardHeaders(req);
      const projectId = req.params.projectId;

      const [coreWorkbench, feedback, reporting, forecast] = await Promise.all([
        fetchService({
          method: 'GET',
          targetBase: services.project,
          path: `/${projectId}/agent-workbench`,
          headers,
          query: value,
        }),
        fetchService({
          method: 'GET',
          targetBase: services.feedback,
          path: '/learning',
          headers,
          query: { projectId },
        }),
        fetchService({
          method: 'GET',
          targetBase: services.reporting,
          path: '/',
          headers,
          query: { reportType: 'executive-summary' },
        }),
        fetchService({
          method: 'GET',
          targetBase: services.forecast,
          path: '/',
          headers,
          query: { forecastType: 'PORTFOLIO' },
        }),
      ]);

      if (!coreWorkbench.ok) {
        return res.status(coreWorkbench.status).json(coreWorkbench.data);
      }

      const workbench = enrichWorkbench(coreWorkbench.data.workbench, {
        feedback,
        reporting,
        forecast,
      });

      logger.info({
        msg: 'agent.workbench.generated',
        userId: req.user?.id,
        projectId,
        serviceStatus: workbench.serviceStatus,
      });

      return res.status(200).json({ workbench });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAgentRouter,
};