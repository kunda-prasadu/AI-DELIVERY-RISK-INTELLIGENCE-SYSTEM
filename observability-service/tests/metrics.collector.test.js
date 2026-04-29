'use strict';

const metricsCollector = require('../src/models/metrics.collector');

beforeEach(() => metricsCollector._reset());

describe('MetricsCollector.recordHttpRequest', () => {
  test('records HTTP request', () => {
    metricsCollector.recordHttpRequest('GET', '/projects', 200, 45);
    const count = metricsCollector.httpRequestsTotal.get('GET:/projects:200');
    expect(count).toBe(1);
  });

  test('increments counter on repeated requests', () => {
    metricsCollector.recordHttpRequest('POST', '/auth/login', 200, 50);
    metricsCollector.recordHttpRequest('POST', '/auth/login', 200, 55);
    metricsCollector.recordHttpRequest('POST', '/auth/login', 200, 52);
    const count = metricsCollector.httpRequestsTotal.get('POST:/auth/login:200');
    expect(count).toBe(3);
  });

  test('separates requests by status code', () => {
    metricsCollector.recordHttpRequest('GET', '/projects', 200, 45);
    metricsCollector.recordHttpRequest('GET', '/projects', 404, 10);
    expect(metricsCollector.httpRequestsTotal.get('GET:/projects:200')).toBe(1);
    expect(metricsCollector.httpRequestsTotal.get('GET:/projects:404')).toBe(1);
  });

  test('stores request durations for histogram', () => {
    metricsCollector.recordHttpRequest('GET', '/health', 200, 5);
    metricsCollector.recordHttpRequest('GET', '/health', 200, 6);
    metricsCollector.recordHttpRequest('GET', '/health', 200, 7);
    const durations = metricsCollector.httpRequestDurations.get('GET:/health');
    expect(durations).toEqual([5, 6, 7]);
  });
});

describe('MetricsCollector.recordError', () => {
  test('records errors by type', () => {
    metricsCollector.recordError('ValidationError');
    metricsCollector.recordError('ValidationError');
    metricsCollector.recordError('TimeoutError');
    expect(metricsCollector.applicationErrorsTotal.get('ValidationError')).toBe(2);
    expect(metricsCollector.applicationErrorsTotal.get('TimeoutError')).toBe(1);
  });
});

describe('MetricsCollector.setServiceHealth', () => {
  test('stores service health status', () => {
    metricsCollector.setServiceHealth('db', true, { latency: '2ms' });
    const health = metricsCollector.getServiceHealth('db');
    expect(health.healthy).toBe(true);
    expect(health.details.latency).toBe('2ms');
  });

  test('unhealthy service recorded', () => {
    metricsCollector.setServiceHealth('cache', false, { error: 'Connection refused' });
    const health = metricsCollector.getServiceHealth('cache');
    expect(health.healthy).toBe(false);
  });
});

describe('MetricsCollector.exportPrometheus', () => {
  test('exports metrics in Prometheus format', () => {
    metricsCollector.recordHttpRequest('GET', '/health', 200, 25);
    metricsCollector.recordError('TimeoutError');
    metricsCollector.setServiceHealth('self', true);

    const output = metricsCollector.exportPrometheus();
    expect(output).toContain('http_requests_total');
    expect(output).toContain('http_request_duration_seconds');
    expect(output).toContain('application_errors_total');
    expect(output).toContain('service_health');
    expect(output).toContain('process_uptime_seconds');
  });

  test('prometheus output contains TYPE declarations', () => {
    metricsCollector.recordHttpRequest('GET', '/status', 200, 10);
    const output = metricsCollector.exportPrometheus();
    expect(output).toContain('# TYPE http_requests_total counter');
    expect(output).toContain('# TYPE service_health gauge');
  });
});

describe('MetricsCollector.getSummary', () => {
  test('returns summary stats', () => {
    metricsCollector.recordHttpRequest('GET', '/test', 200, 10);
    metricsCollector.recordHttpRequest('GET', '/test', 500, 5);
    metricsCollector.recordError('TestError');
    metricsCollector.setServiceHealth('svc-1', true);
    metricsCollector.setServiceHealth('svc-2', false);

    const summary = metricsCollector.getSummary();
    expect(summary.totalRequests).toBe(2);
    expect(summary.totalErrors).toBe(1);
    expect(summary.healthyServices).toBe(1);
    expect(summary.totalServices).toBe(2);
  });
});
