'use strict';

const BaseConnector = require('../src/connectors/base.connector');
const auditLogger = require('../src/middleware/audit.logger');

/**
 * Unit tests for BaseConnector lifecycle — retry, DLQ routing, per-item error isolation.
 * US-E-101-03
 */

// ── Minimal concrete subclass for testing ─────────────────────────────────────

class MockConnector extends BaseConnector {
  constructor(fetchImpl, normalizeImpl) {
    super({ retryAttempts: 2, retryDelayMs: 10 });
    this._fetchImpl = fetchImpl;
    this._normalizeImpl = normalizeImpl || ((r) => ({ ...r, id: r.id, source: 'jira', eventType: 'issue', project: 'TEST', title: r.title || 'x', status: 'open', severity: 'low', author: null, assignee: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dueDate: null, metrics: {}, labels: [], rawId: r.id, schemaVersion: 'v1', runId: null, ingestedAt: new Date().toISOString() }));
  }

  get name() { return 'MockConnector'; }
  get source() { return 'jira'; }
  async _fetch() { return this._fetchImpl(); }
  _normalize(raw) { return this._normalizeImpl(raw); }
}

describe('BaseConnector.run', () => {
  test('returns success with event count on happy path', async () => {
    const connector = new MockConnector(
      async () => [{ id: 'MOCK-1', title: 'Issue A' }, { id: 'MOCK-2', title: 'Issue B' }]
    );

    const dataEvents = [];
    connector.on('data', (e) => dataEvents.push(e));

    const result = await connector.run();

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(dataEvents).toHaveLength(2);
  });

  test('emits error event and returns DLQ result when all retries fail', async () => {
    let attempts = 0;
    const connector = new MockConnector(
      async () => {
        attempts++;
        throw new Error('API down');
      }
    );

    const errorEvents = [];
    connector.on('error', (e) => errorEvents.push(e));

    const result = await connector.run();

    expect(result.success).toBe(false);
    expect(result.count).toBe(0);
    expect(errorEvents).toHaveLength(1);
    expect(attempts).toBeGreaterThanOrEqual(2); // at least initial + 1 retry
  });

  test('skips individual malformed records without aborting the batch', async () => {
    const connector = new MockConnector(
      async () => [{ id: 'MOCK-3', title: 'Good' }, { id: 'BAD' }],
      (raw) => {
        if (raw.id === 'BAD') throw new Error('bad record');
        return {
          id: raw.id, source: 'jira', eventType: 'issue', project: 'TEST',
          title: raw.title, status: 'open', severity: 'low', author: null,
          assignee: null, createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(), dueDate: null,
          metrics: {}, labels: [], rawId: raw.id, schemaVersion: 'v1',
          runId: null, ingestedAt: new Date().toISOString(),
        };
      }
    );

    const dataEvents = [];
    connector.on('data', (e) => dataEvents.push(e));

    const result = await connector.run();

    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(dataEvents).toHaveLength(1);
    expect(dataEvents[0].id).toBe('MOCK-3');
  });

  test('attaches runId to each emitted event', async () => {
    const connector = new MockConnector(
      async () => [{ id: 'MOCK-4', title: 'Some issue' }]
    );

    const dataEvents = [];
    connector.on('data', (e) => dataEvents.push(e));

    await connector.run();

    expect(dataEvents[0].runId).toBeTruthy();
    expect(typeof dataEvents[0].runId).toBe('string');
  });

  test('creates an audit record on successful run', async () => {
    const before = auditLogger.tail(1);

    const connector = new MockConnector(
      async () => [{ id: 'MOCK-5', title: 'Audit test' }]
    );
    connector.on('data', () => {});

    await connector.run();

    const after = auditLogger.tail(1);
    const lastEntry = after[after.length - 1];
    expect(lastEntry.status).toBe('OK');
    expect(lastEntry.source).toBe('jira');
  });
});
