'use strict';

const request = require('supertest');
const { startStack } = require('./utils/stack.harness');

describe('E-109 baseline load smoke', () => {
  let stack;
  let api;
  let token;

  beforeAll(async () => {
    stack = await startStack();
    api = request(stack.gatewayBaseUrl);

    const reg = await api.post('/api/auth/register').send({
      email: `e109_load_${Date.now()}@example.com`,
      password: 'Admin@1234!',
      name: 'Load Admin',
      role: 'admin',
    });
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await stack.close();
  });

  test('meets API and dashboard p95 SLOs under concurrent load', async () => {
    const iterations = 40;
    const tasks = [];

    for (let i = 0; i < iterations; i += 1) {
      tasks.push(api.get('/api/observability/health/live'));
      tasks.push(api.get('/api/projects').set('Authorization', `Bearer ${token}`));
      tasks.push(
        api.post('/api/observability/metrics/frontend').send({
          route: '/dashboard',
          durationMs: 420 + (i % 5) * 60,
        })
      );
    }

    const start = Date.now();
    const responses = await Promise.all(tasks);
    const durationMs = Date.now() - start;

    const successCount = responses.filter((res) => res.status >= 200 && res.status < 300).length;
    const total = responses.length;
    const successRate = successCount / total;
    const sloSummary = await api.get('/api/observability/metrics/slo');

    expect(successRate).toBeGreaterThanOrEqual(0.95);
    expect(durationMs).toBeLessThan(5000);
    expect(sloSummary.status).toBe(200);
    expect(sloSummary.body.api.overall.withinTarget).toBe(true);
    expect(sloSummary.body.dashboard.overall.withinTarget).toBe(true);
    expect(sloSummary.body.api.overall.p95Ms).toBeLessThanOrEqual(sloSummary.body.api.targetP95Ms);
    expect(sloSummary.body.dashboard.overall.p95Ms).toBeLessThanOrEqual(sloSummary.body.dashboard.targetP95Ms);
  });
});
