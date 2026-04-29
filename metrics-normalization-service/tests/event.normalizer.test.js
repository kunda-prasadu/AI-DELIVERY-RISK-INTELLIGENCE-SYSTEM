'use strict';

const { normalizeEvent, normalizeBatch } = require('../src/models/event.normalizer');

describe('event.normalizer', () => {
  test('normalizes valid event', () => {
    const result = normalizeEvent({
      id: 'ev-1',
      source: 'github',
      eventType: 'pr_opened',
      projectId: 'p-1',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'high',
      metadata: { repo: 'x' },
    });

    expect(result.valid).toBe(true);
    expect(result.event.id).toBe('ev-1');
    expect(result.event.source).toBe('github');
  });

  test('maps unknown severity to medium', () => {
    const result = normalizeEvent({
      source: 'jira',
      eventType: 'ticket_created',
      projectId: 'p-1',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'P9',
    });

    expect(result.valid).toBe(true);
    expect(result.event.severity).toBe('medium');
  });

  test('rejects invalid source', () => {
    const result = normalizeEvent({
      source: 'slack',
      eventType: 'message',
      projectId: 'p-1',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'low',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('must be one of');
  });

  test('applies defaults for missing fields', () => {
    const result = normalizeEvent({ source: 'qa' });

    expect(result.valid).toBe(true);
    expect(result.event.eventType).toBe('unknown');
    expect(result.event.projectId).toBe('unknown-project');
    expect(result.event.metadata).toEqual({});
  });

  test('normalizes batch with accepted and rejected', () => {
    const result = normalizeBatch([
      {
        source: 'github',
        eventType: 'commit',
        projectId: 'p-1',
        timestamp: '2026-04-29T10:00:00.000Z',
        severity: 'low',
      },
      {
        source: 'invalid',
        eventType: 'whatever',
        projectId: 'p-1',
        timestamp: '2026-04-29T10:00:00.000Z',
        severity: 'low',
      },
    ]);

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });
});
