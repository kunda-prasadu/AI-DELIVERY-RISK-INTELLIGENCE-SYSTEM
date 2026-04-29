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

  test('handles concurrent health checks and protected reads', async () => {
    const iterations = 60;
    const tasks = [];

    for (let i = 0; i < iterations; i += 1) {
      tasks.push(api.get('/api/observability/health/live'));
      tasks.push(api.get('/api/projects').set('Authorization', `Bearer ${token}`));
    }

    const start = Date.now();
    const responses = await Promise.all(tasks);
    const durationMs = Date.now() - start;

    const successCount = responses.filter((res) => res.status >= 200 && res.status < 300).length;
    const total = responses.length;
    const successRate = successCount / total;

    expect(successRate).toBeGreaterThanOrEqual(0.95);
    expect(durationMs).toBeLessThan(5000);
  });
});
