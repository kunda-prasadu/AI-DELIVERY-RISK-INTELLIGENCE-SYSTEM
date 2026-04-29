'use strict';

function getTrendDirection(current, previous) {
  if (previous === 0 && current === 0) return 'stable';
  if (previous === 0 && current > 0) return 'up';

  const delta = current - previous;
  const ratio = Math.abs(delta) / previous;

  if (ratio < 0.1) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

function analyzeProjectTrend(currentMetrics, previousMetrics) {
  if (!currentMetrics || !previousMetrics) {
    return {
      projectId: currentMetrics?.projectId || previousMetrics?.projectId || 'unknown',
      trend: 'insufficient_data',
      deltaEvents: 0,
      details: {},
    };
  }

  const currentTotal = currentMetrics.totalEvents || 0;
  const previousTotal = previousMetrics.totalEvents || 0;

  const criticalCurrent = currentMetrics.severityCounts?.critical || 0;
  const criticalPrevious = previousMetrics.severityCounts?.critical || 0;

  const totalDirection = getTrendDirection(currentTotal, previousTotal);
  const criticalDirection = getTrendDirection(criticalCurrent, criticalPrevious);

  let trend = 'stable';
  if (criticalDirection === 'up') trend = 'regression';
  else if (criticalDirection === 'down' && totalDirection !== 'up') trend = 'improving';
  else if (totalDirection === 'up' && criticalDirection === 'stable') trend = 'watch';

  return {
    projectId: currentMetrics.projectId,
    trend,
    deltaEvents: currentTotal - previousTotal,
    details: {
      totalDirection,
      criticalDirection,
      currentTotal,
      previousTotal,
      criticalCurrent,
      criticalPrevious,
    },
  };
}

module.exports = {
  getTrendDirection,
  analyzeProjectTrend,
};
