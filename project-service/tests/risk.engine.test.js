'use strict';

const { computeScore, getBand, clamp } = require('../src/models/risk.engine');
const EventStore = require('../src/models/event.store');

beforeEach(() => EventStore._reset());

describe('clamp', () => {
  test('clamps to 0 for negatives', () => expect(clamp(-10)).toBe(0));
  test('clamps to 100 for values over 100', () => expect(clamp(150)).toBe(100));
  test('rounds to nearest integer', () => expect(clamp(45.6)).toBe(46));
});

describe('getBand', () => {
  test('LOW for score 0–25', () => {
    expect(getBand(0)).toBe('LOW');
    expect(getBand(25)).toBe('LOW');
  });
  test('MEDIUM for score 26–50', () => {
    expect(getBand(26)).toBe('MEDIUM');
    expect(getBand(50)).toBe('MEDIUM');
  });
  test('HIGH for score 51–75', () => {
    expect(getBand(51)).toBe('HIGH');
    expect(getBand(75)).toBe('HIGH');
  });
  test('CRITICAL for score 76–100', () => {
    expect(getBand(76)).toBe('CRITICAL');
    expect(getBand(100)).toBe('CRITICAL');
  });
});

describe('computeScore', () => {
  test('returns required shape', () => {
    const result = computeScore('proj-001');
    expect(result).toMatchObject({
      projectId: 'proj-001',
      score: expect.any(Number),
      band: expect.any(String),
      signals: expect.objectContaining({
        codeVelocity: expect.any(Number),
        quality: expect.any(Number),
        cicd: expect.any(Number),
        jiraVelocity: expect.any(Number),
      }),
      eventCount: expect.any(Number),
      computedAt: expect.any(String),
    });
  });

  test('score is in valid 0-100 range', () => {
    const { score } = computeScore('proj-001');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test('all signal scores are in 0-100 range', () => {
    const { signals } = computeScore('proj-003');
    for (const val of Object.values(signals)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });

  test('proj-003 (at_risk) has higher score than proj-001 (healthy)', () => {
    const risk001 = computeScore('proj-001').score;
    const risk003 = computeScore('proj-003').score;
    expect(risk003).toBeGreaterThan(risk001);
  });

  test('returns eventCount matching stored events', () => {
    const { eventCount } = computeScore('proj-001');
    expect(eventCount).toBeGreaterThan(0);
  });

  test('project with no events returns 0 eventCount and computes score', () => {
    const result = computeScore('proj-unknown-no-events');
    expect(result.eventCount).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
