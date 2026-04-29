'use strict';

const { normalizeQAEvent, normalizeCICDEvent } = require('../src/normalizer/normalizer');

/**
 * Unit tests for QA and CI/CD normalizers.
 * US-E-101-03
 */

// ── QA normalizer tests ───────────────────────────────────────────────────────

describe('normalizeQAEvent', () => {
  const rawRun = {
    id: 'run-001',
    project: 'auth-service',
    name: 'Regression Suite',
    total: 100,
    passed: 92,
    failed: 8,
    skipped: 0,
    startedAt: '2024-03-21T06:00:00Z',
    finishedAt: '2024-03-21T06:15:00Z',
    triggeredBy: 'ci-pipeline',
  };

  test('produces QA NormalizedEvent with correct metrics', () => {
    const event = normalizeQAEvent(rawRun, 'testng');
    expect(event.source).toBe('qa');
    expect(event.eventType).toBe('test_run');
    expect(event.project).toBe('auth-service');
    expect(event.metrics.total).toBe(100);
    expect(event.metrics.passed).toBe(92);
    expect(event.metrics.failed).toBe(8);
    expect(event.metrics.passRate).toBe(92);
    expect(event.status).toBe('partial');
    expect(event.severity).toBe('medium');
    expect(event.labels).toContain('testng');
  });

  test('100% pass rate maps to passed status with low severity', () => {
    const event = normalizeQAEvent({ ...rawRun, passed: 100, failed: 0, total: 100 }, 'jest');
    expect(event.status).toBe('passed');
    expect(event.severity).toBe('low');
  });

  test('20%+ failure rate maps to high severity', () => {
    const event = normalizeQAEvent({ ...rawRun, passed: 60, failed: 40, total: 100 });
    expect(event.severity).toBe('high');
  });

  test('handles zero total gracefully (no division by zero)', () => {
    const event = normalizeQAEvent({ ...rawRun, total: 0, passed: 0, failed: 0 });
    expect(event.metrics.passRate).toBeNull();
    expect(event.status).toBe('unknown');
  });

  test('handles alternative field names (passCount / failCount)', () => {
    const raw = {
      id: 'run-002',
      project: 'payment-service',
      name: 'Smoke Tests',
      tests: 50,
      passCount: 48,
      failCount: 2,
      startedAt: '2024-03-21T10:00:00Z',
      finishedAt: '2024-03-21T10:05:00Z',
    };
    const event = normalizeQAEvent(raw, 'allure');
    expect(event.metrics.total).toBe(50);
    expect(event.metrics.passed).toBe(48);
    expect(event.metrics.failed).toBe(2);
  });
});

// ── CI/CD normalizer tests ────────────────────────────────────────────────────

describe('normalizeCICDEvent — jenkins', () => {
  const rawBuild = {
    _provider: 'jenkins',
    _jobName: 'deploy-api',
    number: 77,
    result: 'SUCCESS',
    timestamp: 1711008000000,
    duration: 120000,
  };

  test('produces CI/CD NormalizedEvent for Jenkins success', () => {
    const event = normalizeCICDEvent(rawBuild, 'jenkins');
    expect(event.source).toBe('cicd');
    expect(event.eventType).toBe('pipeline_run');
    expect(event.id).toBe('deploy-api#77');
    expect(event.project).toBe('deploy-api');
    expect(event.status).toBe('passed');
    expect(event.severity).toBe('unknown');
    expect(event.metrics.durationMs).toBe(120000);
    expect(event.labels).toContain('jenkins');
  });

  test('Jenkins FAILURE maps to failed status with high severity', () => {
    const event = normalizeCICDEvent({ ...rawBuild, result: 'FAILURE' }, 'jenkins');
    expect(event.status).toBe('failed');
    expect(event.severity).toBe('high');
  });

  test('Jenkins UNSTABLE maps to partial status with medium severity', () => {
    const event = normalizeCICDEvent({ ...rawBuild, result: 'UNSTABLE' }, 'jenkins');
    expect(event.status).toBe('partial');
    expect(event.severity).toBe('medium');
  });
});

describe('normalizeCICDEvent — gitlab', () => {
  const rawPipeline = {
    _provider: 'gitlab',
    _projectName: 'my-org/backend',
    _projectId: 123,
    id: 500,
    status: 'failed',
    ref: 'main',
    user: { username: 'alice' },
    created_at: '2024-03-22T08:00:00Z',
    updated_at: '2024-03-22T08:10:00Z',
    duration: 600,
  };

  test('produces CI/CD NormalizedEvent for GitLab failure', () => {
    const event = normalizeCICDEvent(rawPipeline, 'gitlab');
    expect(event.source).toBe('cicd');
    expect(event.eventType).toBe('pipeline_run');
    expect(event.status).toBe('failed');
    expect(event.severity).toBe('high');
    expect(event.author).toBe('alice');
    expect(event.labels).toContain('gitlab');
    expect(event.labels).toContain('main');
  });

  test('GitLab success pipeline maps to passed', () => {
    const event = normalizeCICDEvent({ ...rawPipeline, status: 'success' }, 'gitlab');
    expect(event.status).toBe('passed');
  });
});

describe('normalizeCICDEvent — unknown provider', () => {
  test('throws for unknown provider', () => {
    expect(() => normalizeCICDEvent({}, 'bamboo')).toThrow();
  });
});
