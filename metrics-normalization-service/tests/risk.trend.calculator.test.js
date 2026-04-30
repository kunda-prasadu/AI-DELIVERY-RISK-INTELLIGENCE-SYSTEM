'use strict';

const { computeRiskScore, scoreToBand, deriveTrendDirection, buildRiskTrend } = require('../src/models/risk.trend.calculator');

describe('risk.trend.calculator', () => {
  describe('computeRiskScore', () => {
    test('returns 0 for null snapshot', () => {
      expect(computeRiskScore(null)).toBe(0);
    });

    test('computes weighted score from severity counts', () => {
      // critical=2(50) + high=1(10) + medium=0 + low=0 = 60
      expect(computeRiskScore({ severityCounts: { critical: 2, high: 1, medium: 0, low: 0 } })).toBe(60);
    });

    test('caps at 100', () => {
      expect(computeRiskScore({ severityCounts: { critical: 10, high: 10, medium: 10, low: 10 } })).toBe(100);
    });

    test('handles missing severityCounts gracefully', () => {
      expect(computeRiskScore({ totalEvents: 5 })).toBe(0);
    });
  });

  describe('scoreToBand', () => {
    test('returns CRITICAL for score >= 75', () => {
      expect(scoreToBand(75)).toBe('CRITICAL');
      expect(scoreToBand(100)).toBe('CRITICAL');
    });

    test('returns HIGH for score 50–74', () => {
      expect(scoreToBand(50)).toBe('HIGH');
      expect(scoreToBand(74)).toBe('HIGH');
    });

    test('returns MEDIUM for score 25–49', () => {
      expect(scoreToBand(25)).toBe('MEDIUM');
      expect(scoreToBand(49)).toBe('MEDIUM');
    });

    test('returns LOW for score < 25', () => {
      expect(scoreToBand(0)).toBe('LOW');
      expect(scoreToBand(24)).toBe('LOW');
    });
  });

  describe('deriveTrendDirection', () => {
    test('returns insufficient_data for fewer than 2 snapshots', () => {
      expect(deriveTrendDirection([])).toBe('insufficient_data');
      expect(deriveTrendDirection([50])).toBe('insufficient_data');
    });

    test('returns worsening when final score exceeds initial by more than 5', () => {
      expect(deriveTrendDirection([20, 30, 40, 55])).toBe('worsening');
    });

    test('returns improving when final score drops by more than 5', () => {
      expect(deriveTrendDirection([80, 70, 60, 50])).toBe('improving');
    });

    test('returns stable when delta is within ±5', () => {
      expect(deriveTrendDirection([50, 52, 51, 53])).toBe('stable');
    });
  });

  describe('buildRiskTrend', () => {
    test('returns insufficient_data response when history is empty', () => {
      const result = buildRiskTrend('p-empty', []);
      expect(result.projectId).toBe('p-empty');
      expect(result.trend).toBe('insufficient_data');
      expect(result.snapshots).toHaveLength(0);
    });

    test('builds full trend response from history', () => {
      const now = new Date().toISOString();
      const history = [
        {
          snapshotAt: now,
          metrics: { severityCounts: { critical: 1, high: 0, medium: 0, low: 0 }, totalEvents: 1 },
        },
        {
          snapshotAt: now,
          metrics: { severityCounts: { critical: 3, high: 1, medium: 0, low: 0 }, totalEvents: 4 },
        },
      ];

      const result = buildRiskTrend('p-001', history);
      expect(result.projectId).toBe('p-001');
      expect(result.snapshots).toHaveLength(2);
      expect(result.snapshots[0].riskScore).toBe(25);   // critical=1 → 25
      expect(result.snapshots[0].band).toBe('MEDIUM');
      expect(result.snapshots[1].riskScore).toBe(85);   // critical=3(75)+high=1(10) = 85 → capped = 85
      expect(result.snapshots[1].band).toBe('CRITICAL');
      expect(result.trend).toBe('worsening');
      expect(result.deltaScore).toBe(60);
    });
  });
});
