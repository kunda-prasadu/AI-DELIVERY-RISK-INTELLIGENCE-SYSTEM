import { getRecommendedActionsForAnomaly } from './risk-guidance';

describe('getRecommendedActionsForAnomaly', () => {
  it('should return escalation and stabilization actions for critical regression', () => {
    const actions = getRecommendedActionsForAnomaly({
      projectId: 'p-critical',
      severity: 'CRITICAL',
      anomalyScore: 96,
      trend: 'regression',
      reasons: ['critical trend is regressing compared to previous snapshot'],
      metrics: {
        totalEvents: 9,
        severityCounts: { low: 0, medium: 1, high: 2, critical: 6 },
        latestEventAt: new Date().toISOString(),
      },
    });

    expect(actions.join(' ')).toContain('Escalate to the delivery and engineering leads within 24 hours');
    expect(actions.join(' ')).toContain('Freeze non-essential scope changes');
    expect(actions.join(' ')).toContain('Run a root-cause review for critical events');
  });

  it('should return lightweight monitoring action for low stable anomaly', () => {
    const actions = getRecommendedActionsForAnomaly({
      projectId: 'p-low',
      severity: 'LOW',
      anomalyScore: 24,
      trend: 'stable',
      reasons: ['delivery signals are stable with minor variance'],
      metrics: {
        totalEvents: 4,
        severityCounts: { low: 3, medium: 1, high: 0, critical: 0 },
        latestEventAt: new Date().toISOString(),
      },
    });

    expect(actions).toEqual([
      'Track in the weekly risk review and assign an owner to validate corrective actions.',
    ]);
  });
});
