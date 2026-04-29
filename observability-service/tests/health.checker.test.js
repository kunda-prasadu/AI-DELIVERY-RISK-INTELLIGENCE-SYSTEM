'use strict';

const healthChecker = require('../src/models/health.checker');

beforeEach(() => {
  healthChecker.checks.clear();
  healthChecker._registerDefaultChecks();
});

describe('HealthChecker.register', () => {
  test('registers a custom check', async () => {
    healthChecker.register('custom', async () => ({ healthy: true }));
    const result = await healthChecker.runAll();
    expect(result.checks.custom).toBeDefined();
  });
});

describe('HealthChecker.liveness', () => {
  test('returns 200 for liveness', async () => {
    const result = await healthChecker.liveness();
    expect(result.status).toBe('alive');
    expect(result.timestamp).toBeDefined();
  });
});

describe('HealthChecker.readiness', () => {
  test('returns ready state', async () => {
    const result = await healthChecker.readiness();
    expect(result.ready).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.summary.healthy).toBeDefined();
  });

  test('marks all checks as healthy by default', async () => {
    const result = await healthChecker.readiness();
    expect(result.summary.healthy).toBe(true);
  });

  test('registers default self check', async () => {
    const result = await healthChecker.readiness();
    expect(result.checks.self).toBeDefined();
    expect(result.checks.self.healthy).toBe(true);
  });

  test('registers required service checks from config', async () => {
    const result = await healthChecker.readiness();
    // Should have checks for 'identity-service' and 'project-service'
    expect(result.checks['identity-service']).toBeDefined();
    expect(result.checks['project-service']).toBeDefined();
  });
});

describe('HealthChecker.runAll', () => {
  test('returns summary with all checks', async () => {
    const result = await healthChecker.runAll();
    expect(result.summary).toEqual({
      healthy: true,
      totalChecks: expect.any(Number),
      healthyChecks: expect.any(Number),
    });
  });

  test('marks result unhealthy if any check fails', async () => {
    healthChecker.register('failing-check', async () => ({ healthy: false }));
    const result = await healthChecker.runAll();
    expect(result.summary.healthy).toBe(false);
  });

  test('handles check timeout', async () => {
    healthChecker.register('slow-check', async () => {
      return new Promise(resolve => setTimeout(() => resolve({ healthy: true }), 10000));
    });
    const result = await healthChecker.runAll();
    expect(result.checks['slow-check'].healthy).toBe(false);
  }, 10000); // 10s timeout for this test

  test('includes elapsed time for checks', async () => {
    const result = await healthChecker.runAll();
    const checkElapsed = Object.values(result.checks)[0].elapsed;
    expect(checkElapsed).toBeGreaterThanOrEqual(0);
  });
});

describe('HealthChecker.getServiceHealth', () => {
  test('returns null for unregistered service', () => {
    const health = healthChecker.getServiceHealth('nonexistent');
    expect(health).toBeNull();
  });
});
