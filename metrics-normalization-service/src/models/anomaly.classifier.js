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

/**
 * Classify the structural type of an anomaly:
 *  - spike        : sudden surge with prior baseline (regression + previous had low events)
 *  - sustained    : high critical count persisting regardless of trend
 *  - trend_shift  : trend moved from stable/improving to regression/watch
 *  - none         : no notable pattern
 */
function classifyAnomalyType(metrics, trend, previousMetrics) {
  const critical = metrics.severityCounts?.critical || 0;
  const prevCritical = previousMetrics?.severityCounts?.critical || 0;

  if (trend.trend === 'regression') {
    if (prevCritical === 0 && critical >= 2) return 'spike';
    if (critical >= 3 && prevCritical >= 2) return 'sustained';
    return 'trend_shift';
  }

  if (trend.trend === 'watch' && critical >= 1) return 'spike';
  if (critical >= 3) return 'sustained';

  return 'none';
}

/**
 * Calculate classifier confidence (0–100).
 * Higher when previous snapshot is available and event volume is sufficient.
 */
function calculateConfidence(metrics, hasPrevious) {
  const totalEvents = metrics.totalEvents || 0;
  let confidence = hasPrevious ? 70 : 40;
  if (totalEvents >= 10) confidence = Math.min(100, confidence + 20);
  else if (totalEvents >= 5) confidence = Math.min(100, confidence + 10);
  return confidence;
}

/**
 * Determine whether severity has escalated compared to a previous classification.
 * Returns true when current severity is strictly worse than previous.
 */
function isEscalated(currentSeverity, previousMetrics, trend) {
  if (!previousMetrics) return false;
  const prevScore = calculateAnomalyScore(
    previousMetrics,
    { trend: trend.trend === 'regression' ? 'stable' : trend.trend }
  );
  const prevSeverity = classifySeverity(prevScore);
  const order = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  return (order[currentSeverity] ?? 0) > (order[prevSeverity] ?? 0);
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
  const anomalyType = classifyAnomalyType(currentMetrics, trend, previousMetrics);
  const confidence = calculateConfidence(currentMetrics, !!previousMetrics);
  const escalated = isEscalated(severity, previousMetrics, trend);

  return {
    projectId: currentMetrics.projectId,
    severity,
    anomalyScore,
    anomalyType,
    confidence,
    escalated,
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

/**
 * Aggregate portfolio-level anomaly summary stats.
 */
function summarisePortfolioAnomalies(anomalies = []) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let escalatedCount = 0;

  for (const a of anomalies) {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
    if (a.escalated) escalatedCount++;
  }

  return {
    totalProjects: anomalies.length,
    criticalCount: counts.CRITICAL,
    highCount: counts.HIGH,
    mediumCount: counts.MEDIUM,
    lowCount: counts.LOW,
    escalatedCount,
    topAnomalies: anomalies.slice(0, 3).map((a) => ({
      projectId: a.projectId,
      severity: a.severity,
      anomalyScore: a.anomalyScore,
      anomalyType: a.anomalyType,
      escalated: a.escalated,
    })),
  };
}

module.exports = {
  classifyProjectAnomaly,
  classifyPortfolioAnomalies,
  summarisePortfolioAnomalies,
  classifyAnomalyType,
  calculateConfidence,
};