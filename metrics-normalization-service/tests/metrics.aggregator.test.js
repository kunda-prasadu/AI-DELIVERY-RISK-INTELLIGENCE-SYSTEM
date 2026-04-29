'use strict';

const aggregator = require('../src/models/metrics.aggregator');

const baseEvent = {
  source: 'github',
  eventType: 'commit',
  projectId: 'proj-1',
  timestamp: '2026-04-29T10:00:00.000Z',
  severity: 'low',
};

describe('metrics.aggregator', () => {
  beforeEach(() => {
    aggregator._reset();
  });

  test('ingests single event', () => {
    aggregator.ingest(baseEvent);
    const metrics = aggregator.getProjectMetrics('proj-1');

    expect(metrics).not.toBeNull();
    expect(metrics.totalEvents).toBe(1);
    expect(metrics.sourceCounts.github).toBe(1);
    expect(metrics.severityCounts.low).toBe(1);
    expect(metrics.eventTypeCounts.commit).toBe(1);
  });

  test('ingests batch and updates summary', () => {
    aggregator.ingestBatch([
      baseEvent,
      { ...baseEvent, severity: 'critical', eventType: 'build_failed', source: 'cicd' },
      { ...baseEvent, projectId: 'proj-2', source: 'jira', eventType: 'issue_blocked', severity: 'high' },
    ]);

    const summary = aggregator.summary();
    expect(summary.totalEvents).toBe(3);
    expect(summary.projects).toBe(2);
    expect(summary.projectsWithCritical).toBe(1);
    expect(summary.projectsWithHigh).toBe(1);
  });

  test('returns null for unknown project', () => {
    expect(aggregator.getProjectMetrics('does-not-exist')).toBeNull();
  });

  test('tracks latest event timestamp', () => {
    aggregator.ingest({ ...baseEvent, timestamp: '2026-04-29T09:00:00.000Z' });
    aggregator.ingest({ ...baseEvent, timestamp: '2026-04-29T11:00:00.000Z' });

    const metrics = aggregator.getProjectMetrics('proj-1');
    expect(metrics.latestEventAt).toBe('2026-04-29T11:00:00.000Z');
  });

  test('lists project metrics', () => {
    aggregator.ingest(baseEvent);
    aggregator.ingest({ ...baseEvent, projectId: 'proj-2' });

    const list = aggregator.listProjectMetrics();
    expect(list).toHaveLength(2);
  });
});
