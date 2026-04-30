'use strict';

/**
 * Default alert thresholds — can be overridden via environment or future config API.
 */
const DEFAULT_THRESHOLDS = {
  criticalEventCount: parseInt(process.env.ALERT_CRITICAL_EVENT_THRESHOLD || '3', 10),
  riskScore: parseInt(process.env.ALERT_RISK_SCORE_THRESHOLD || '70', 10),
  regressionStreak: parseInt(process.env.ALERT_REGRESSION_STREAK || '1', 10), // consecutive snapshots worsening
};

/**
 * Alert severity levels derived from how many thresholds are breached.
 */
function deriveAlertSeverity(breachCount) {
  if (breachCount >= 3) return 'CRITICAL';
  if (breachCount === 2) return 'HIGH';
  if (breachCount === 1) return 'MEDIUM';
  return null;
}

/**
 * Evaluate a single project snapshot against the thresholds.
 *
 * @param {object} metrics  - current aggregated metrics for the project
 * @param {object} trend    - result from buildRiskTrend (may be null if no history)
 * @param {object} thresholds - optional override
 * @returns {object} alert result
 */
function evaluateProjectAlerts(metrics, trend, thresholds = DEFAULT_THRESHOLDS) {
  if (!metrics) {
    return null;
  }

  const breaches = [];
  const critical = metrics.severityCounts?.critical || 0;
  const riskScore = trend?.snapshots?.length
    ? trend.snapshots[trend.snapshots.length - 1].riskScore
    : 0;

  if (critical >= thresholds.criticalEventCount) {
    breaches.push({
      rule: 'CRITICAL_EVENT_COUNT',
      message: `Critical event count (${critical}) reached or exceeded threshold of ${thresholds.criticalEventCount}.`,
      actual: critical,
      threshold: thresholds.criticalEventCount,
    });
  }

  if (riskScore >= thresholds.riskScore) {
    breaches.push({
      rule: 'RISK_SCORE',
      message: `Risk score (${riskScore}) reached or exceeded threshold of ${thresholds.riskScore}.`,
      actual: riskScore,
      threshold: thresholds.riskScore,
    });
  }

  if (trend?.trend === 'worsening') {
    breaches.push({
      rule: 'TREND_WORSENING',
      message: `Project risk trajectory is worsening over the last ${trend.snapshots?.length || 0} snapshots.`,
      actual: trend.deltaScore,
      threshold: 0,
    });
  }

  const severity = deriveAlertSeverity(breaches.length);

  return {
    projectId: metrics.projectId,
    active: breaches.length > 0,
    severity,
    breachCount: breaches.length,
    breaches,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluate alerts for all projects in the portfolio.
 *
 * @param {object[]} allMetrics - array of project metrics
 * @param {function} getTrend   - (projectId) => trend object or null
 * @param {object}   thresholds - optional override
 * @returns {object[]} only projects with active alerts, sorted by breachCount desc
 */
function evaluatePortfolioAlerts(allMetrics, getTrend, thresholds = DEFAULT_THRESHOLDS) {
  return allMetrics
    .map((m) => evaluateProjectAlerts(m, getTrend(m.projectId), thresholds))
    .filter((a) => a && a.active)
    .sort((a, b) => b.breachCount - a.breachCount);
}

module.exports = {
  DEFAULT_THRESHOLDS,
  deriveAlertSeverity,
  evaluateProjectAlerts,
  evaluatePortfolioAlerts,
};
