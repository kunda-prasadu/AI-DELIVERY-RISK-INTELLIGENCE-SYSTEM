'use strict';

const {
  classifyProjectAnomaly,
  classifyPortfolioAnomalies,
  summarisePortfolioAnomalies,
  classifyAnomalyType,
  calculateConfidence,
} = require('../src/models/anomaly.classifier');

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMetrics(overrides = {}) {
  return {
    projectId: 'p1',
    totalEvents: 5,
    severityCounts: { critical: 0, high: 0, medium: 1, low: 2 },
    latestEventAt: Date.now(),
    ...overrides,
  };
}

// ── classifyProjectAnomaly ───────────────────────────────────────────────────

describe('anomaly.classifier', () => {
  describe('classifyProjectAnomaly', () => {
    test('returns null for missing metrics', () => {
      expect(classifyProjectAnomaly(null, null)).toBeNull();
    });

    test('returns CRITICAL severity for high critical event count', () => {
      const metrics = makeMetrics({ totalEvents: 12, severityCounts: { critical: 3, high: 1, medium: 0, low: 0 } });
      const result = classifyProjectAnomaly(metrics, null);
      expect(result.severity).toBe('CRITICAL');
      expect(result.anomalyScore).toBeGreaterThanOrEqual(80);
    });

    test('returns LOW severity for low-impact metrics', () => {
      const metrics = makeMetrics({ totalEvents: 2, severityCounts: { critical: 0, high: 0, medium: 0, low: 1 } });
      const result = classifyProjectAnomaly(metrics, null);
      expect(result.severity).toBe('LOW');
    });

    test('includes anomalyType in result', () => {
      const metrics = makeMetrics({ totalEvents: 5, severityCounts: { critical: 1, high: 0, medium: 0, low: 0 } });
      const result = classifyProjectAnomaly(metrics, null);
      expect(result).toHaveProperty('anomalyType');
      expect(['spike', 'sustained', 'trend_shift', 'none']).toContain(result.anomalyType);
    });

    test('includes confidence in result', () => {
      const metrics = makeMetrics();
      const result = classifyProjectAnomaly(metrics, null);
      expect(result).toHaveProperty('confidence');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    test('confidence is higher when previous metrics are provided', () => {
      const metrics = makeMetrics({ totalEvents: 5, severityCounts: { critical: 1, high: 0, medium: 0, low: 0 } });
      const previous = makeMetrics({ totalEvents: 3, severityCounts: { critical: 0, high: 1, medium: 0, low: 0 } });
      const withPrev = classifyProjectAnomaly(metrics, previous);
      const withoutPrev = classifyProjectAnomaly(metrics, null);
      expect(withPrev.confidence).toBeGreaterThan(withoutPrev.confidence);
    });

    test('includes escalated flag in result', () => {
      const metrics = makeMetrics();
      const result = classifyProjectAnomaly(metrics, null);
      expect(result).toHaveProperty('escalated');
      expect(typeof result.escalated).toBe('boolean');
    });

    test('escalated is true when severity worsens from previous snapshot', () => {
      const prev = makeMetrics({ totalEvents: 1, severityCounts: { critical: 0, high: 0, medium: 0, low: 1 } });
      const current = makeMetrics({ totalEvents: 12, severityCounts: { critical: 3, high: 2, medium: 0, low: 0 } });
      const result = classifyProjectAnomaly(current, prev);
      expect(result.escalated).toBe(true);
    });

    test('escalated is false when no previous metrics', () => {
      const metrics = makeMetrics({ totalEvents: 8, severityCounts: { critical: 2, high: 0, medium: 0, low: 0 } });
      const result = classifyProjectAnomaly(metrics, null);
      expect(result.escalated).toBe(false);
    });

    test('includes reasons array with at least one entry', () => {
      const metrics = makeMetrics();
      const result = classifyProjectAnomaly(metrics, null);
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    test('includes metrics snapshot in result', () => {
      const metrics = makeMetrics({ totalEvents: 3 });
      const result = classifyProjectAnomaly(metrics, null);
      expect(result.metrics.totalEvents).toBe(3);
      expect(result.metrics).toHaveProperty('severityCounts');
    });
  });

  // ── classifyAnomalyType ────────────────────────────────────────────────────

  describe('classifyAnomalyType', () => {
    test('returns spike when regression with no prior criticals', () => {
      const metrics = makeMetrics({ severityCounts: { critical: 3, high: 0, medium: 0, low: 0 } });
      const trend = { trend: 'regression' };
      const previous = makeMetrics({ severityCounts: { critical: 0, high: 0, medium: 0, low: 0 } });
      expect(classifyAnomalyType(metrics, trend, previous)).toBe('spike');
    });

    test('returns sustained when high critical count persists across snapshots', () => {
      const metrics = makeMetrics({ severityCounts: { critical: 4, high: 0, medium: 0, low: 0 } });
      const trend = { trend: 'regression' };
      const previous = makeMetrics({ severityCounts: { critical: 3, high: 0, medium: 0, low: 0 } });
      expect(classifyAnomalyType(metrics, trend, previous)).toBe('sustained');
    });

    test('returns trend_shift for regression with moderate criticals', () => {
      const metrics = makeMetrics({ severityCounts: { critical: 1, high: 0, medium: 0, low: 0 } });
      const trend = { trend: 'regression' };
      const previous = makeMetrics({ severityCounts: { critical: 1, high: 0, medium: 0, low: 0 } });
      expect(classifyAnomalyType(metrics, trend, previous)).toBe('trend_shift');
    });

    test('returns none for stable low-severity metrics', () => {
      const metrics = makeMetrics({ severityCounts: { critical: 0, high: 0, medium: 1, low: 2 } });
      const trend = { trend: 'stable' };
      expect(classifyAnomalyType(metrics, trend, null)).toBe('none');
    });

    test('returns sustained when critical >= 3 regardless of trend', () => {
      const metrics = makeMetrics({ severityCounts: { critical: 3, high: 0, medium: 0, low: 0 } });
      const trend = { trend: 'stable' };
      expect(classifyAnomalyType(metrics, trend, null)).toBe('sustained');
    });
  });

  // ── calculateConfidence ────────────────────────────────────────────────────

  describe('calculateConfidence', () => {
    test('returns lower confidence without previous snapshot', () => {
      const conf = calculateConfidence(makeMetrics({ totalEvents: 3 }), false);
      expect(conf).toBeLessThan(70);
    });

    test('returns higher confidence with previous snapshot', () => {
      const conf = calculateConfidence(makeMetrics({ totalEvents: 3 }), true);
      expect(conf).toBeGreaterThanOrEqual(70);
    });

    test('boosts confidence for high event volume', () => {
      const low = calculateConfidence(makeMetrics({ totalEvents: 2 }), true);
      const high = calculateConfidence(makeMetrics({ totalEvents: 15 }), true);
      expect(high).toBeGreaterThan(low);
    });

    test('confidence never exceeds 100', () => {
      const conf = calculateConfidence(makeMetrics({ totalEvents: 100 }), true);
      expect(conf).toBeLessThanOrEqual(100);
    });
  });

  // ── classifyPortfolioAnomalies ─────────────────────────────────────────────

  describe('classifyPortfolioAnomalies', () => {
    test('returns empty array for empty input', () => {
      expect(classifyPortfolioAnomalies([], () => null)).toEqual([]);
    });

    test('sorts by anomalyScore descending', () => {
      const low = makeMetrics({ projectId: 'low', totalEvents: 1, severityCounts: { critical: 0, high: 0, medium: 1, low: 0 } });
      const high = makeMetrics({ projectId: 'high', totalEvents: 12, severityCounts: { critical: 3, high: 1, medium: 0, low: 0 } });
      const results = classifyPortfolioAnomalies([low, high], () => null);
      expect(results[0].projectId).toBe('high');
      expect(results[0].anomalyScore).toBeGreaterThanOrEqual(results[1].anomalyScore);
    });

    test('all results include anomalyType and confidence', () => {
      const metrics = [
        makeMetrics({ projectId: 'a' }),
        makeMetrics({ projectId: 'b', severityCounts: { critical: 1, high: 0, medium: 0, low: 0 } }),
      ];
      const results = classifyPortfolioAnomalies(metrics, () => null);
      for (const r of results) {
        expect(r).toHaveProperty('anomalyType');
        expect(r).toHaveProperty('confidence');
        expect(r).toHaveProperty('escalated');
      }
    });
  });

  // ── summarisePortfolioAnomalies ────────────────────────────────────────────

  describe('summarisePortfolioAnomalies', () => {
    test('returns zero counts for empty input', () => {
      const summary = summarisePortfolioAnomalies([]);
      expect(summary.totalProjects).toBe(0);
      expect(summary.criticalCount).toBe(0);
      expect(summary.escalatedCount).toBe(0);
      expect(summary.topAnomalies).toEqual([]);
    });

    test('counts severity buckets correctly', () => {
      const anomalies = [
        { severity: 'CRITICAL', escalated: true, anomalyScore: 90, projectId: 'a', anomalyType: 'spike' },
        { severity: 'CRITICAL', escalated: false, anomalyScore: 85, projectId: 'b', anomalyType: 'sustained' },
        { severity: 'HIGH', escalated: true, anomalyScore: 60, projectId: 'c', anomalyType: 'trend_shift' },
        { severity: 'LOW', escalated: false, anomalyScore: 10, projectId: 'd', anomalyType: 'none' },
      ];
      const summary = summarisePortfolioAnomalies(anomalies);
      expect(summary.totalProjects).toBe(4);
      expect(summary.criticalCount).toBe(2);
      expect(summary.highCount).toBe(1);
      expect(summary.lowCount).toBe(1);
      expect(summary.escalatedCount).toBe(2);
    });

    test('topAnomalies contains at most 3 entries', () => {
      const anomalies = Array.from({ length: 10 }, (_, i) => ({
        severity: 'HIGH', escalated: false, anomalyScore: 60 - i, projectId: `p${i}`, anomalyType: 'none',
      }));
      const summary = summarisePortfolioAnomalies(anomalies);
      expect(summary.topAnomalies.length).toBe(3);
    });

    test('topAnomalies includes projectId, severity, anomalyScore, anomalyType, escalated', () => {
      const anomalies = [
        { severity: 'HIGH', escalated: false, anomalyScore: 60, projectId: 'x', anomalyType: 'spike' },
      ];
      const [top] = summarisePortfolioAnomalies(anomalies).topAnomalies;
      expect(top).toMatchObject({ projectId: 'x', severity: 'HIGH', anomalyScore: 60, anomalyType: 'spike', escalated: false });
    });
  });
});
