'use strict';

const { getTrendDirection, analyzeProjectTrend } = require('../src/models/trend.analyzer');

describe('trend.analyzer', () => {
  test('returns stable when both are zero', () => {
    expect(getTrendDirection(0, 0)).toBe('stable');
  });

  test('returns up when previous is zero and current positive', () => {
    expect(getTrendDirection(5, 0)).toBe('up');
  });

  test('returns stable for small deltas', () => {
    expect(getTrendDirection(108, 100)).toBe('stable');
  });

  test('returns down for significant decrease', () => {
    expect(getTrendDirection(60, 100)).toBe('down');
  });

  test('returns insufficient_data without previous metrics', () => {
    const result = analyzeProjectTrend({ projectId: 'p1' }, null);
    expect(result.trend).toBe('insufficient_data');
  });

  test('flags regression when critical increases', () => {
    const result = analyzeProjectTrend(
      {
        projectId: 'p1',
        totalEvents: 120,
        severityCounts: { critical: 4 },
      },
      {
        projectId: 'p1',
        totalEvents: 100,
        severityCounts: { critical: 1 },
      }
    );

    expect(result.trend).toBe('regression');
  });

  test('flags improving when critical decreases and volume not rising', () => {
    const result = analyzeProjectTrend(
      {
        projectId: 'p1',
        totalEvents: 90,
        severityCounts: { critical: 1 },
      },
      {
        projectId: 'p1',
        totalEvents: 100,
        severityCounts: { critical: 4 },
      }
    );

    expect(result.trend).toBe('improving');
  });
});
