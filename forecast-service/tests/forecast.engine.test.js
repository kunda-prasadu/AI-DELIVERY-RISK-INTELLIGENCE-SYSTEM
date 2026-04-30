const {
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
} = require('../src/models/forecast.engine');

describe('forecast.engine.js — helpers', () => {
  describe('stddev', () => {
    it('returns 0 for empty array', () => expect(stddev([])).toBe(0));
    it('returns 0 for single value', () => expect(stddev([5])).toBe(0));
    it('computes correctly', () => {
      const result = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result).toBeCloseTo(2.0, 1);
    });
  });

  describe('coefficientOfVariation', () => {
    it('returns 100 for empty', () => expect(coefficientOfVariation([])).toBe(100));
    it('returns 100 for zero-mean', () => expect(coefficientOfVariation([0, 0, 0])).toBe(100));
    it('returns low CV for tight data', () => {
      const cv = coefficientOfVariation([40, 41, 40, 39, 40]);
      expect(cv).toBeLessThan(5);
    });
  });

  describe('confidenceFromCV', () => {
    it('HIGH when cv < 10', () => expect(confidenceFromCV(5)).toBe(CONFIDENCE.HIGH));
    it('MEDIUM when cv between 10 and 25', () => expect(confidenceFromCV(20)).toBe(CONFIDENCE.MEDIUM));
    it('LOW when cv > 25', () => expect(confidenceFromCV(50)).toBe(CONFIDENCE.LOW));
  });

  describe('linearRegression', () => {
    it('returns flat line for single point', () => {
      const r = linearRegression([0], [10]);
      expect(r.slope).toBe(0);
      expect(r.intercept).toBe(10);
    });
    it('fits a perfect line', () => {
      const x = [0, 1, 2, 3, 4];
      const y = x.map(v => 2 * v + 5);
      const r = linearRegression(x, y);
      expect(r.slope).toBeCloseTo(2, 5);
      expect(r.intercept).toBeCloseTo(5, 5);
      expect(r.r2).toBeCloseTo(1, 5);
    });
    it('handles zero denominator', () => {
      const r = linearRegression([2, 2, 2], [4, 6, 8]);
      expect(r.slope).toBe(0);
    });
  });
});

describe('buildCompletionForecast', () => {
  const base = {
    projectId: 'p1',
    projectName: 'Alpha',
    remainingPoints: 80,
    sprintVelocities: [40, 42, 38, 41],
  };

  it('estimates completion date', () => {
    const r = buildCompletionForecast(base);
    expect(r.forecastType).toBe(FORECAST_TYPES.COMPLETION);
    expect(r.estimatedCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.avgVelocity).toBeGreaterThan(0);
    expect(r.estimatedSprintsRemaining).toBeGreaterThan(0);
  });

  it('confidence is HIGH for stable velocity', () => {
    const r = buildCompletionForecast({ ...base, sprintVelocities: [40, 40, 40, 40] });
    expect(r.confidence).toBe(CONFIDENCE.HIGH);
  });

  it('confidence is LOW for erratic velocity', () => {
    const r = buildCompletionForecast({ ...base, sprintVelocities: [10, 80, 5, 70] });
    expect(r.confidence).toBe(CONFIDENCE.LOW);
  });

  it('returns null dates when velocity is 0', () => {
    const r = buildCompletionForecast({ ...base, sprintVelocities: [0, 0] });
    expect(r.estimatedCompletionDate).toBeNull();
    expect(r.estimatedSprintsRemaining).toBeNull();
  });

  it('returns null dates for empty velocities', () => {
    const r = buildCompletionForecast({ ...base, sprintVelocities: [] });
    expect(r.estimatedCompletionDate).toBeNull();
  });
});

describe('buildRiskTrendForecast', () => {
  const base = {
    projectId: 'p2',
    projectName: 'Beta',
    riskHistory: [
      { date: '2026-03-01', score: 30 },
      { date: '2026-03-08', score: 40 },
      { date: '2026-03-15', score: 50 },
      { date: '2026-03-22', score: 60 },
    ],
    weeksAhead: 4,
  };

  it('produces 4 projections', () => {
    const r = buildRiskTrendForecast(base);
    expect(r.forecastType).toBe(FORECAST_TYPES.RISK_TREND);
    expect(r.projections.length).toBe(4);
  });

  it('direction is WORSENING for rising scores', () => {
    const r = buildRiskTrendForecast(base);
    expect(r.trend.direction).toBe('WORSENING');
  });

  it('direction is IMPROVING for falling scores', () => {
    const r = buildRiskTrendForecast({
      ...base,
      riskHistory: [
        { date: '2026-03-01', score: 80 },
        { date: '2026-03-08', score: 65 },
        { date: '2026-03-15', score: 50 },
        { date: '2026-03-22', score: 35 },
      ],
    });
    expect(r.trend.direction).toBe('IMPROVING');
  });

  it('direction is STABLE for flat scores', () => {
    const r = buildRiskTrendForecast({
      ...base,
      riskHistory: [
        { date: '2026-03-01', score: 40 },
        { date: '2026-03-08', score: 40 },
        { date: '2026-03-15', score: 40 },
        { date: '2026-03-22', score: 40 },
      ],
    });
    expect(r.trend.direction).toBe('STABLE');
  });
});

describe('buildVelocityForecast', () => {
  it('produces projections', () => {
    const r = buildVelocityForecast({
      projectId: 'p3',
      projectName: 'Gamma',
      sprintVelocities: [35, 38, 42, 40, 44],
      sprintsAhead: 3,
    });
    expect(r.forecastType).toBe(FORECAST_TYPES.VELOCITY);
    expect(r.projections.length).toBe(3);
    r.projections.forEach(p => expect(p.projectedVelocity).toBeGreaterThanOrEqual(0));
  });
});

describe('buildPortfolioForecast', () => {
  const projects = [
    {
      projectId: 'p1',
      projectName: 'Alpha',
      remainingPoints: 60,
      sprintVelocities: [30, 31, 29, 30],
      riskHistory: [
        { date: '2026-03-01', score: 25 },
        { date: '2026-03-08', score: 27 },
      ],
    },
    {
      projectId: 'p2',
      projectName: 'Beta',
      remainingPoints: 100,
      sprintVelocities: [20, 5, 40, 10],
      riskHistory: [
        { date: '2026-03-01', score: 55 },
        { date: '2026-03-08', score: 70 },
        { date: '2026-03-15', score: 85 },
      ],
    },
  ];

  it('aggregates completion and risk trends', () => {
    const r = buildPortfolioForecast(projects);
    expect(r.forecastType).toBe(FORECAST_TYPES.PORTFOLIO);
    expect(r.totalProjects).toBe(2);
    expect(r.completionForecasts.length).toBe(2);
    expect(r.riskTrends.length).toBe(2);
    expect(typeof r.summary.worseningCount).toBe('number');
    expect(typeof r.summary.atRiskCount).toBe('number');
  });

  it('handles empty projects list', () => {
    const r = buildPortfolioForecast([]);
    expect(r.totalProjects).toBe(0);
    expect(r.completionForecasts.length).toBe(0);
  });
});

describe('generateForecast', () => {
  it('dispatches COMPLETION type', () => {
    const r = generateForecast({
      forecastType: FORECAST_TYPES.COMPLETION,
      projectId: 'px',
      remainingPoints: 50,
      sprintVelocities: [25, 26, 24],
    });
    expect(r.forecastType).toBe(FORECAST_TYPES.COMPLETION);
  });

  it('dispatches RISK_TREND type', () => {
    const r = generateForecast({
      forecastType: FORECAST_TYPES.RISK_TREND,
      projectId: 'px',
      riskHistory: [{ date: '2026-03-01', score: 30 }, { date: '2026-03-08', score: 40 }],
    });
    expect(r.forecastType).toBe(FORECAST_TYPES.RISK_TREND);
  });

  it('dispatches VELOCITY type', () => {
    const r = generateForecast({
      forecastType: FORECAST_TYPES.VELOCITY,
      projectId: 'px',
      sprintVelocities: [30, 32],
    });
    expect(r.forecastType).toBe(FORECAST_TYPES.VELOCITY);
  });

  it('dispatches PORTFOLIO type', () => {
    const r = generateForecast({
      forecastType: FORECAST_TYPES.PORTFOLIO,
      projects: [{ projectId: 'px', sprintVelocities: [30], remainingPoints: 20 }],
    });
    expect(r.forecastType).toBe(FORECAST_TYPES.PORTFOLIO);
  });

  it('throws 400 for unknown type', () => {
    expect(() => generateForecast({ forecastType: 'UNKNOWN' })).toThrow();
  });
});
