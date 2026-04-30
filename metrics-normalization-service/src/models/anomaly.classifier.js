'use strict';

const { analyzeProjectTrend } = require('./trend.analyzer');

function calculateAnomalyScore(metrics, trend) {
  const critical = metrics.severityCounts?.critical || 0;
  const high = metrics.severityCounts?.high || 0;
  const medium = metrics.severityCounts?.medium || 0;
  const totalEvents = metrics.totalEvents || 0;

  let score = critical * 40 + high * 20 + medium * 8;

  if (trend.trend === 'regression') score += 25;
  if (trend.trend === 'watch') score += 12;
  if (totalEvents >= 10) score += 10;

  return Math.min(score, 100);
}

function classifySeverity(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

function buildReasons(metrics, trend) {
  const reasons = [];
  const critical = metrics.severityCounts?.critical || 0;
  const high = metrics.severityCounts?.high || 0;
  const totalEvents = metrics.totalEvents || 0;

  if (critical > 0) {
    reasons.push(`${critical} critical event${critical === 1 ? '' : 's'} detected`);
  }

  if (high >= 2) {
    reasons.push(`${high} high-severity events detected`);
  }

  if (trend.trend === 'regression') {
    reasons.push('critical trend is regressing compared to previous snapshot');
  } else if (trend.trend === 'watch') {
    reasons.push('event volume increased and requires monitoring');
  } else if (trend.trend === 'insufficient_data') {
    reasons.push('previous snapshot unavailable; classification based on current metrics only');
  }

  if (totalEvents >= 10) {
    reasons.push('elevated event volume detected');
  }

  if (!reasons.length) {
    reasons.push('no significant anomaly patterns detected');
  }

  return reasons;
}

function classifyProjectAnomaly(currentMetrics, previousMetrics) {
  if (!currentMetrics) return null;

  const trend = analyzeProjectTrend(currentMetrics, previousMetrics);
  const anomalyScore = calculateAnomalyScore(currentMetrics, trend);
  const severity = classifySeverity(anomalyScore);

  return {
    projectId: currentMetrics.projectId,
    severity,
    anomalyScore,
    trend: trend.trend,
    reasons: buildReasons(currentMetrics, trend),
    metrics: {
      totalEvents: currentMetrics.totalEvents,
      severityCounts: currentMetrics.severityCounts,
      latestEventAt: currentMetrics.latestEventAt,
    },
  };
}

function classifyPortfolioAnomalies(projectMetrics = [], previousSnapshotLookup = () => null) {
  return projectMetrics
    .map((metrics) => classifyProjectAnomaly(metrics, previousSnapshotLookup(metrics.projectId)))
    .filter(Boolean)
    .sort((left, right) => right.anomalyScore - left.anomalyScore);
}

module.exports = {
  classifyProjectAnomaly,
  classifyPortfolioAnomalies,
};