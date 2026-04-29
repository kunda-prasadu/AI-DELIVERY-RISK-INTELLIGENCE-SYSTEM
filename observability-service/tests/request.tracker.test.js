'use strict';

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const request = require('supertest');
const app = require('../src/index');
const metricsCollector = require('../src/models/metrics.collector');

beforeEach(() => {
  metricsCollector._reset();
});

describe('Request Tracker Middleware', () => {
  test('adds correlation ID to request', async () => {
    const res = await request(app).get('/status');
    expect(res.header['x-correlation-id']).toBeDefined();
  });

  test('records HTTP request metrics', async () => {
    await request(app).get('/status');
    const count = metricsCollector.httpRequestsTotal.get('GET:/status:200');
    expect(count).toBe(1);
  });

  test('records request duration', async () => {
    await request(app).get('/status');
    const durations = metricsCollector.httpRequestDurations.get('GET:/status');
    expect(durations).toBeDefined();
    expect(durations.length).toBeGreaterThan(0);
  });

  test('tracks multiple request types', async () => {
    await request(app).get('/health/live');
    await request(app).get('/health/ready');
    await request(app).get('/metrics');

    expect(metricsCollector.httpRequestsTotal.get('GET:/health/live:200')).toBe(1);
    expect(metricsCollector.httpRequestsTotal.get('GET:/health/ready:200')).toBe(1);
    expect(metricsCollector.httpRequestsTotal.get('GET:/metrics:200')).toBe(1);
  });

  test('tracks error status codes', async () => {
    await request(app).get('/nonexistent');
    const count = metricsCollector.httpRequestsTotal.get('GET:/nonexistent:404');
    expect(count).toBe(1);
  });

  test('uses custom correlation ID if provided', async () => {
    const res = await request(app)
      .get('/status')
      .set('X-Correlation-ID', 'custom-id-123');
    expect(res.header['x-correlation-id']).toBe('custom-id-123');
  });

  test('generates unique correlation IDs for each request', async () => {
    const res1 = await request(app).get('/status');
    const res2 = await request(app).get('/status');
    expect(res1.header['x-correlation-id']).not.toBe(res2.header['x-correlation-id']);
  });
});

describe('Error Recording', () => {
  test('records errors in metrics', async () => {
    // Make a request that causes no error (200)
    await request(app).get('/status');
    
    // Errors are recorded only if middleware catches them
    const errorCount = Array.from(metricsCollector.applicationErrorsTotal.values()).reduce((a, b) => a + b, 0);
    // Should be 0 for successful requests
    expect(errorCount).toBe(0);
  });
});

describe('Request Latency', () => {
  test('measures and records request latency', async () => {
    await request(app).get('/status');
    const durations = metricsCollector.httpRequestDurations.get('GET:/status');
    expect(durations).toBeDefined();
    expect(durations[0]).toBeGreaterThanOrEqual(0);
  });
});
