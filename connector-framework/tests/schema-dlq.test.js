'use strict';

const schemaValidator = require('../src/middleware/schema.validator');
const dlq = require('../src/queue/dead-letter.handler');

/**
 * Unit tests for schema validator (MW-02) and dead-letter queue (BE-01, MW-01).
 * US-E-101-03
 */

const validEvent = () => ({
  id: 'PROJ-100',
  rawId: '10100',
  source: 'jira',
  eventType: 'issue',
  project: 'PROJ',
  title: 'Sample issue',
  status: 'open',
  severity: 'medium',
  assignee: 'dev@example.com',
  author: 'pm@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-03-01T00:00:00.000Z',
  dueDate: null,
  metrics: { storyPoints: 3 },
  labels: ['backend'],
  schemaVersion: 'v1',
  runId: 'run-abc',
  ingestedAt: '2024-03-01T12:00:00.000Z',
});

// ── SchemaValidator tests ─────────────────────────────────────────────────────

describe('SchemaValidator.validate', () => {
  test('accepts a fully valid event', () => {
    const result = schemaValidator.validate(validEvent());
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
    expect(result.value).toBeTruthy();
  });

  test('rejects event missing required id', () => {
    const { id: _, ...noId } = validEvent();
    const result = schemaValidator.validate(noId);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.value).toBeNull();
  });

  test('rejects event with invalid source', () => {
    const result = schemaValidator.validate({ ...validEvent(), source: 'slack' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('source'))).toBe(true);
  });

  test('rejects event with invalid severity', () => {
    const result = schemaValidator.validate({ ...validEvent(), severity: 'catastrophic' });
    expect(result.valid).toBe(false);
  });

  test('rejects event with malformed createdAt date', () => {
    const result = schemaValidator.validate({ ...validEvent(), createdAt: 'not-a-date' });
    expect(result.valid).toBe(false);
  });

  test('strips unknown fields from value', () => {
    const withExtra = { ...validEvent(), unknownField: 'should-be-removed' };
    const result = schemaValidator.validate(withExtra);
    expect(result.valid).toBe(true);
    expect(result.value.unknownField).toBeUndefined();
  });

  test('applies default severity=unknown when not provided', () => {
    const { severity: _, ...noSeverity } = validEvent();
    const result = schemaValidator.validate(noSeverity);
    expect(result.valid).toBe(true);
    expect(result.value.severity).toBe('unknown');
  });
});

// ── DeadLetterQueue tests ─────────────────────────────────────────────────────

describe('DeadLetterQueue', () => {
  beforeEach(() => {
    // Drain the DLQ before each test for isolation
    dlq.flush();
  });

  test('size starts at 0 after flush', () => {
    expect(dlq.size).toBe(0);
  });

  test('push adds an entry and increments size', () => {
    dlq.push({ runId: 'run-1', source: 'jira', error: new Error('timeout') });
    expect(dlq.size).toBe(1);
  });

  test('list returns a copy (not a reference)', () => {
    dlq.push({ runId: 'run-2', source: 'github', error: 'network error' });
    const list = dlq.list();
    list.push({ fake: true });
    expect(dlq.size).toBe(1); // original unchanged
  });

  test('remove deletes entry by runId', () => {
    dlq.push({ runId: 'run-3', source: 'qa', error: 'parse error' });
    const removed = dlq.remove('run-3');
    expect(removed).toBe(true);
    expect(dlq.size).toBe(0);
  });

  test('remove returns false for unknown runId', () => {
    const removed = dlq.remove('nonexistent');
    expect(removed).toBe(false);
  });

  test('flush returns all entries and empties queue', () => {
    dlq.push({ runId: 'run-4', source: 'cicd', error: 'auth failed' });
    dlq.push({ runId: 'run-5', source: 'jira', error: '500 error' });
    const entries = dlq.flush();
    expect(entries.length).toBe(2);
    expect(dlq.size).toBe(0);
  });

  test('error objects have their message captured', () => {
    dlq.push({ runId: 'run-6', source: 'jira', error: new Error('connection refused') });
    const entries = dlq.list();
    expect(entries[0].errorMessage).toBe('connection refused');
  });
});
