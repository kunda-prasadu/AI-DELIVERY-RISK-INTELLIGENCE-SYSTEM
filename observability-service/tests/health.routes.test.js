'use strict';

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const request = require('supertest');
const app = require('../src/index');
const healthChecker = require('../src/models/health.checker');
const metricsCollector = require('../src/models/metrics.collector');

beforeEach(() => {
  metricsCollector._reset();
  healthChecker.checks.clear();
  healthChecker._registerDefaultChecks();
});

describe('GET /health/live', () => {
  test('returns 200 for liveness probe', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  test('always returns 200 regardless of dependencies', async () => {
    // Register a failing check
    healthChecker.register('failing', async () => ({ healthy: false }));

    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
  });
});

describe('GET /health/ready', () => {
  test('returns 200 when ready', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  test('returns 503 when not ready (failed check)', async () => {
    healthChecker.register('critical', async () => ({ healthy: false }));
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.ready).toBe(false);
  });

  test('includes check details in response', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.body.checks).toBeDefined();
    expect(res.body.summary).toBeDefined();
  });
});

describe('GET /health/detailed', () => {
  test('returns detailed health report', async () => {
    const res = await request(app).get('/health/detailed');
    expect(res.status).toBe(200);
    expect(res.body.checks).toBeDefined();
    expect(res.body.summary).toBeDefined();
  });

  test('includes all registered checks', async () => {
    healthChecker.register('custom-1', async () => ({ healthy: true, details: 'ok' }));
    healthChecker.register('custom-2', async () => ({ healthy: true, details: 'ok' }));

    const res = await request(app).get('/health/detailed');
    expect(res.body.checks['custom-1']).toBeDefined();
    expect(res.body.checks['custom-2']).toBeDefined();
  });
});

describe('GET /metrics', () => {
  test('exports metrics in Prometheus format', async () => {
    // Generate some metrics
    metricsCollector.recordHttpRequest('GET', '/api/test', 200, 50);
    metricsCollector.recordError('TestError');

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/plain');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('application_errors_total');
  });

  test('prometheus output has proper format', async () => {
    metricsCollector.recordHttpRequest('POST', '/api/submit', 201, 100);
    const res = await request(app).get('/metrics');
    const lines = res.text.split('\n');
    
    // Check for TYPE declarations
    expect(res.text).toContain('# TYPE http_requests_total');
    expect(res.text).toContain('# TYPE http_request_duration_seconds');
    expect(res.text).toContain('# TYPE application_errors_total');
  });
});

describe('GET /metrics/summary', () => {
  test('returns JSON summary', async () => {
    metricsCollector.recordHttpRequest('GET', '/api', 200, 25);
    metricsCollector.recordHttpRequest('POST', '/api', 500, 10);
    metricsCollector.recordError('RuntimeError');
    metricsCollector.setServiceHealth('svc', true);

    const res = await request(app).get('/metrics/summary');
    expect(res.status).toBe(200);
    expect(res.body.totalRequests).toBe(2);
    expect(res.body.totalErrors).toBe(1);
    expect(res.body.healthyServices).toBe(1);
  });
});

describe('GET /status', () => {
  test('returns service status', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('observability-service');
  });
});

describe('404 Not Found', () => {
  test('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/undefined-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

describe('Correlation ID Header', () => {
  test('propagates correlation ID in response', async () => {
    const res = await request(app)
      .get('/status')
      .set('X-Correlation-ID', 'test-123');
    expect(res.header['x-correlation-id']).toBe('test-123');
  });

  test('generates correlation ID if not provided', async () => {
    const res = await request(app).get('/status');
    expect(res.header['x-correlation-id']).toBeDefined();
  });
});
