'use strict';

const {
  DEFAULT_THRESHOLDS,
  deriveAlertSeverity,
  evaluateProjectAlerts,
  evaluatePortfolioAlerts,
} = require('../src/models/alert.threshold.engine');

describe('alert.threshold.engine', () => {
  describe('deriveAlertSeverity', () => {
    test('returns null for 0 breaches', () => {
      expect(deriveAlertSeverity(0)).toBeNull();
    });

    test('returns MEDIUM for 1 breach', () => {
      expect(deriveAlertSeverity(1)).toBe('MEDIUM');
    });

    test('returns HIGH for 2 breaches', () => {
      expect(deriveAlertSeverity(2)).toBe('HIGH');
    });

    test('returns CRITICAL for 3 breaches', () => {
      expect(deriveAlertSeverity(3)).toBe('CRITICAL');
    });
  });

  describe('evaluateProjectAlerts', () => {
    const baseMetrics = {
      projectId: 'p1',
      totalEvents: 5,
      severityCounts: { critical: 0, high: 1, medium: 2, low: 2 },
    };

    test('returns null when metrics is falsy', () => {
      expect(evaluateProjectAlerts(null, null)).toBeNull();
    });

    test('returns active=false when no thresholds breached', () => {
      const result = evaluateProjectAlerts(baseMetrics, null);
      expect(result.active).toBe(false);
      expect(result.breachCount).toBe(0);
      expect(result.severity).toBeNull();
    });

    test('fires CRITICAL_EVENT_COUNT breach when critical events exceed threshold', () => {
      const metrics = { ...baseMetrics, severityCounts: { critical: 5, high: 0, medium: 0, low: 0 } };
      const result = evaluateProjectAlerts(metrics, null, { ...DEFAULT_THRESHOLDS, criticalEventCount: 3 });
      expect(result.active).toBe(true);
      expect(result.breaches.some((b) => b.rule === 'CRITICAL_EVENT_COUNT')).toBe(true);
    });

    test('fires RISK_SCORE breach when latest snapshot score exceeds threshold', () => {
      const trend = {
        snapshots: [{ riskScore: 80 }],
        trend: 'stable',
        deltaScore: 0,
      };
      const result = evaluateProjectAlerts(baseMetrics, trend, { ...DEFAULT_THRESHOLDS, riskScore: 70 });
      expect(result.active).toBe(true);
      expect(result.breaches.some((b) => b.rule === 'RISK_SCORE')).toBe(true);
    });

    test('fires TREND_WORSENING breach when trend is worsening', () => {
      const trend = {
        snapshots: [{ riskScore: 30 }, { riskScore: 75 }],
        trend: 'worsening',
        deltaScore: 45,
      };
      const result = evaluateProjectAlerts(baseMetrics, trend);
      expect(result.active).toBe(true);
      expect(result.breaches.some((b) => b.rule === 'TREND_WORSENING')).toBe(true);
    });

    test('returns CRITICAL severity when all three thresholds breached', () => {
      const metrics = { ...baseMetrics, severityCounts: { critical: 5, high: 0, medium: 0, low: 0 } };
      const trend = {
        snapshots: [{ riskScore: 85 }],
        trend: 'worsening',
        deltaScore: 40,
      };
      const result = evaluateProjectAlerts(metrics, trend, { criticalEventCount: 3, riskScore: 70, regressionStreak: 1 });
      expect(result.severity).toBe('CRITICAL');
      expect(result.breachCount).toBe(3);
    });

    test('includes evaluatedAt timestamp', () => {
      const result = evaluateProjectAlerts(baseMetrics, null);
      expect(result.evaluatedAt).toBeTruthy();
      expect(() => new Date(result.evaluatedAt)).not.toThrow();
    });
  });

  describe('evaluatePortfolioAlerts', () => {
    test('returns only active alerts sorted by breachCount desc', () => {
      const allMetrics = [
        { projectId: 'p-clean', totalEvents: 1, severityCounts: { critical: 0, high: 1, medium: 0, low: 0 } },
        { projectId: 'p-bad', totalEvents: 8, severityCounts: { critical: 4, high: 2, medium: 1, low: 1 } },
        { projectId: 'p-medium', totalEvents: 4, severityCounts: { critical: 3, high: 0, medium: 0, low: 1 } },
      ];

      const getTrend = (projectId) => {
        if (projectId === 'p-bad') {
          return { snapshots: [{ riskScore: 90 }], trend: 'worsening', deltaScore: 50 };
        }
        return null;
      };

      const alerts = evaluatePortfolioAlerts(allMetrics, getTrend, { criticalEventCount: 3, riskScore: 70, regressionStreak: 1 });

      // p-clean has 0 critical — not in alerts
      expect(alerts.find((a) => a.projectId === 'p-clean')).toBeUndefined();
      // p-bad should be first (most breaches)
      expect(alerts[0].projectId).toBe('p-bad');
      expect(alerts[0].breachCount).toBeGreaterThan(alerts[1].breachCount);
    });

    test('returns empty array when no thresholds breached', () => {
      const allMetrics = [
        { projectId: 'p1', totalEvents: 2, severityCounts: { critical: 0, high: 1, medium: 1, low: 0 } },
      ];
      const alerts = evaluatePortfolioAlerts(allMetrics, () => null);
      expect(alerts).toHaveLength(0);
    });
  });
});
