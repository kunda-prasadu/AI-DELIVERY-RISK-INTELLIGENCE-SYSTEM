/**
 * forecast.engine.js
 * Core forecasting logic for E-303 Portfolio Forecast Analytics.
 *
 * Forecast types:
 *  - COMPLETION  : estimated completion date given velocity + remaining backlog
 *  - RISK_TREND  : 4-week rolling risk-score trajectory per project
 *  - VELOCITY    : sprint velocity trend (story-points delivered per sprint)
 *  - PORTFOLIO   : aggregate health projection across all projects
 */

const FORECAST_TYPES = Object.freeze({
  COMPLETION: 'COMPLETION',
  RISK_TREND: 'RISK_TREND',
  VELOCITY: 'VELOCITY',
  PORTFOLIO: 'PORTFOLIO',
});

const CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',    // < 10 % CV
  MEDIUM: 'MEDIUM',// 10–25 % CV
  LOW: 'LOW',      // > 25 % CV
});

/**
 * Compute population standard deviation for an array of numbers.
 */
function stddev(values) {
  if (!values || values.length === 0) return 0;
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation (%) — measures data spread relative to the mean.
 */
function coefficientOfVariation(values) {
  if (!values || values.length === 0) return 100;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 100;
  return (stddev(values) / Math.abs(mean)) * 100;
}

/**
 * Confidence label from CV.
 */
function confidenceFromCV(cv) {
  if (cv < 10) return CONFIDENCE.HIGH;
  if (cv <= 25) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.LOW;
}

/**
 * Simple linear regression — returns { slope, intercept, r2 }.
 * x: array of numbers (e.g. sprint indices), y: array of measurements.
 */
function linearRegression(x, y) {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] || 0, r2: 0 };
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = x.reduce((s, v, i) => s + v * y[i], 0);
  const sumXX = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssTot = y.reduce((s, v) => s + (v - meanY) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - (slope * x[i] + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

/**
 * buildCompletionForecast
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.projectName
 * @param {number} params.remainingPoints - story points remaining in backlog
 * @param {number[]} params.sprintVelocities - recent sprint velocities (sp/sprint), oldest first
 * @param {number} [params.sprintLengthDays=14] - calendar days per sprint
 * @returns {Object} completionForecast
 */
function buildCompletionForecast({ projectId, projectName, remainingPoints, sprintVelocities, sprintLengthDays = 14 }) {
  const velocities = (sprintVelocities || []).filter(v => typeof v === 'number' && v >= 0);
  const avgVelocity = velocities.length
    ? velocities.reduce((s, v) => s + v, 0) / velocities.length
    : 0;

  let estimatedSprintsRemaining = null;
  let estimatedCompletionDate = null;
  let confidence = CONFIDENCE.LOW;

  if (avgVelocity > 0) {
    const cv = coefficientOfVariation(velocities);
    confidence = confidenceFromCV(cv);

    estimatedSprintsRemaining = remainingPoints / avgVelocity;

    const today = new Date('2026-04-30T00:00:00Z');
    const daysToCompletion = Math.ceil(estimatedSprintsRemaining * sprintLengthDays);
    const completionDate = new Date(today);
    completionDate.setDate(completionDate.getDate() + daysToCompletion);
    estimatedCompletionDate = completionDate.toISOString().slice(0, 10);
  }

  const trend = linearRegression(velocities.map((_, i) => i), velocities);

  return {
    forecastType: FORECAST_TYPES.COMPLETION,
    projectId,
    projectName,
    remainingPoints,
    avgVelocity: Math.round(avgVelocity * 10) / 10,
    sprintVelocities: velocities,
    velocityTrend: { slope: Math.round(trend.slope * 100) / 100, r2: Math.round(trend.r2 * 1000) / 1000 },
    estimatedSprintsRemaining: estimatedSprintsRemaining !== null
      ? Math.round(estimatedSprintsRemaining * 10) / 10
      : null,
    estimatedCompletionDate,
    confidence,
  };
}

/**
 * buildRiskTrendForecast
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.projectName
 * @param {Array<{date: string, score: number}>} params.riskHistory - weekly snapshots, oldest first
 * @param {number} [params.weeksAhead=4] - how many weeks to project forward
 * @returns {Object} riskTrendForecast
 */
function buildRiskTrendForecast({ projectId, projectName, riskHistory, weeksAhead = 4 }) {
  const history = (riskHistory || []).filter(h => h && typeof h.score === 'number');
  const scores = history.map(h => h.score);
  const indices = scores.map((_, i) => i);
  const trend = linearRegression(indices, scores);

  const projections = [];
  const lastIdx = scores.length;
  for (let w = 1; w <= weeksAhead; w++) {
    const projected = Math.max(0, Math.min(100, trend.slope * (lastIdx + w - 1) + trend.intercept));
    projections.push({
      weekOffset: w,
      projectedScore: Math.round(projected * 10) / 10,
    });
  }

  const cv = coefficientOfVariation(scores);
  const confidence = confidenceFromCV(cv);
  const direction = trend.slope > 0.5 ? 'WORSENING' : trend.slope < -0.5 ? 'IMPROVING' : 'STABLE';

  return {
    forecastType: FORECAST_TYPES.RISK_TREND,
    projectId,
    projectName,
    riskHistory: history,
    trend: {
      slope: Math.round(trend.slope * 100) / 100,
      r2: Math.round(trend.r2 * 1000) / 1000,
      direction,
    },
    projections,
    confidence,
  };
}

/**
 * buildVelocityForecast
 * @param {Object} params
 * @param {string} params.projectId
 * @param {string} params.projectName
 * @param {number[]} params.sprintVelocities
 * @param {number} [params.sprintsAhead=3]
 * @returns {Object} velocityForecast
 */
function buildVelocityForecast({ projectId, projectName, sprintVelocities, sprintsAhead = 3 }) {
  const velocities = (sprintVelocities || []).filter(v => typeof v === 'number' && v >= 0);
  const indices = velocities.map((_, i) => i);
  const trend = linearRegression(indices, velocities);

  const projections = [];
  const lastIdx = velocities.length;
  for (let s = 1; s <= sprintsAhead; s++) {
    const projected = Math.max(0, trend.slope * (lastIdx + s - 1) + trend.intercept);
    projections.push({
      sprintOffset: s,
      projectedVelocity: Math.round(projected * 10) / 10,
    });
  }

  const cv = coefficientOfVariation(velocities);
  const confidence = confidenceFromCV(cv);

  return {
    forecastType: FORECAST_TYPES.VELOCITY,
    projectId,
    projectName,
    sprintVelocities: velocities,
    trend: {
      slope: Math.round(trend.slope * 100) / 100,
      r2: Math.round(trend.r2 * 1000) / 1000,
    },
    projections,
    confidence,
  };
}

/**
 * buildPortfolioForecast
 * @param {Array<Object>} projects - array of project payloads (each may have riskHistory, sprintVelocities, remainingPoints)
 * @returns {Object} portfolioForecast
 */
function buildPortfolioForecast(projects) {
  const items = (projects || []);
  const completionForecasts = items
    .filter(p => Array.isArray(p.sprintVelocities) && typeof p.remainingPoints === 'number')
    .map(p => buildCompletionForecast({
      projectId: p.projectId,
      projectName: p.projectName || p.projectId,
      remainingPoints: p.remainingPoints,
      sprintVelocities: p.sprintVelocities,
      sprintLengthDays: p.sprintLengthDays || 14,
    }));

  const riskTrends = items
    .filter(p => Array.isArray(p.riskHistory) && p.riskHistory.length > 0)
    .map(p => buildRiskTrendForecast({
      projectId: p.projectId,
      projectName: p.projectName || p.projectId,
      riskHistory: p.riskHistory,
      weeksAhead: p.weeksAhead || 4,
    }));

  const worseningCount = riskTrends.filter(r => r.trend.direction === 'WORSENING').length;
  const improvingCount = riskTrends.filter(r => r.trend.direction === 'IMPROVING').length;
  const stableCount = riskTrends.filter(r => r.trend.direction === 'STABLE').length;

  const atRiskCompletions = completionForecasts.filter(
    f => f.confidence === CONFIDENCE.LOW || f.estimatedCompletionDate === null
  );

  return {
    forecastType: FORECAST_TYPES.PORTFOLIO,
    totalProjects: items.length,
    forecastedProjects: completionForecasts.length,
    completionForecasts,
    riskTrends,
    summary: {
      worseningCount,
      improvingCount,
      stableCount,
      atRiskCount: atRiskCompletions.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * generateForecast — dispatcher used by the routes layer.
 * @param {Object} payload
 * @param {string} payload.forecastType
 * @param {Object} payload  - type-specific fields
 * @returns {Object}
 */
function generateForecast(payload) {
  switch (payload.forecastType) {
    case FORECAST_TYPES.COMPLETION:
      return buildCompletionForecast(payload);
    case FORECAST_TYPES.RISK_TREND:
      return buildRiskTrendForecast(payload);
    case FORECAST_TYPES.VELOCITY:
      return buildVelocityForecast(payload);
    case FORECAST_TYPES.PORTFOLIO:
      return buildPortfolioForecast(payload.projects);
    default: {
      const err = new Error(`Unknown forecastType: ${payload.forecastType}`);
      err.status = 400;
      throw err;
    }
  }
}

module.exports = {
  FORECAST_TYPES,
  CONFIDENCE,
  stddev,
  coefficientOfVariation,
  confidenceFromCV,
  linearRegression,
  buildCompletionForecast,
  buildRiskTrendForecast,
  buildVelocityForecast,
  buildPortfolioForecast,
  generateForecast,
};
