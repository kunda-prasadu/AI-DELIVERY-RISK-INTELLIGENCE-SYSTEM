'use strict';

const HISTORY_WINDOW = 7;

/**
 * Compute a 0–100 risk score from a raw metrics snapshot.
 * Weighted by severity: critical=25, high=10, medium=4, low=1, capped at 100.
 */
function computeRiskScore(snapshot) {
  if (!snapshot) return 0;
  const { critical = 0, high = 0, medium = 0, low = 0 } = snapshot.severityCounts || {};
  return Math.min(100, critical * 25 + high * 10 + medium * 4 + low * 1);
}

function scoreToBand(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MEDIUM';
  return 'LOW';
}

/**
 * Derive rolling trend direction by comparing oldest to newest snapshot score.
 * @param {number[]} scores - ordered oldest→newest
 */
function deriveTrendDirection(scores) {
  if (scores.length < 2) return 'insufficient_data';
  const delta = scores[scores.length - 1] - scores[0];
  if (delta > 5) return 'worsening';
  if (delta < -5) return 'improving';
  return 'stable';
}

/**
 * Build a risk trend response from an ordered snapshot history array.
 * @param {string} projectId
 * @param {{ snapshotAt: string, metrics: object }[]} history - oldest first, max HISTORY_WINDOW entries
 */
function buildRiskTrend(projectId, history) {
  if (!history || history.length === 0) {
    return {
      projectId,
      window: HISTORY_WINDOW,
      snapshots: [],
      trend: 'insufficient_data',
      deltaScore: 0,
    };
  }

  const snapshots = history.map((entry) => {
    const score = computeRiskScore(entry.metrics);
    return {
      snapshotAt: entry.snapshotAt,
      riskScore: score,
      band: scoreToBand(score),
      criticalCount: entry.metrics?.severityCounts?.critical || 0,
      totalEvents: entry.metrics?.totalEvents || 0,
    };
  });

  const scores = snapshots.map((s) => s.riskScore);
  const trend = deriveTrendDirection(scores);
  const deltaScore = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;

  return {
    projectId,
    window: HISTORY_WINDOW,
    snapshots,
    trend,
    deltaScore,
  };
}

module.exports = {
  computeRiskScore,
  scoreToBand,
  deriveTrendDirection,
  buildRiskTrend,
  HISTORY_WINDOW,
};
