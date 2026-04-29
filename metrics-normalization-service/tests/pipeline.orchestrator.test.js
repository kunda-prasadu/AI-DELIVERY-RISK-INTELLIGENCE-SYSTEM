'use strict';

jest.mock('../src/config/metrics.config', () => ({
  events: { pollingIntervalMs: 10 },
  rateLimit: { windowMs: 1000, max: 10 },
}));

const orchestrator = require('../src/models/pipeline.orchestrator');
const aggregator = require('../src/models/metrics.aggregator');

describe('pipeline.orchestrator', () => {
  beforeEach(() => {
    orchestrator.stop();
    orchestrator.previousSnapshot = new Map();
    aggregator._reset();
  });

  test('starts only once', () => {
    expect(orchestrator.start()).toBe(true);
    expect(orchestrator.start()).toBe(false);
  });

  test('stops running orchestrator', () => {
    orchestrator.start();
    expect(orchestrator.isRunning()).toBe(true);
    expect(orchestrator.stop()).toBe(true);
    expect(orchestrator.isRunning()).toBe(false);
  });

  test('stop returns false when not running', () => {
    expect(orchestrator.stop()).toBe(false);
  });

  test('captures snapshot manually', () => {
    aggregator.ingest({
      source: 'jira',
      eventType: 'issue_created',
      projectId: 'p1',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'low',
    });

    orchestrator.captureSnapshot();
    const prev = orchestrator.getPreviousMetrics('p1');

    expect(prev).not.toBeNull();
    expect(prev.totalEvents).toBe(1);
  });

  test('returns null for missing previous metrics', () => {
    expect(orchestrator.getPreviousMetrics('none')).toBeNull();
  });

  test('snapshot is immutable after new ingests', () => {
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p1',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });

    orchestrator.captureSnapshot();

    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p1',
      timestamp: '2026-04-29T10:05:00.000Z',
      severity: 'critical',
    });

    const prev = orchestrator.getPreviousMetrics('p1');
    expect(prev.totalEvents).toBe(1);
  });
});
