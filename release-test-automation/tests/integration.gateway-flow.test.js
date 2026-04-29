'use strict';

const request = require('supertest');
const { startStack } = require('./utils/stack.harness');

describe('E-109 integration: gateway end-to-end flow', () => {
  let stack;
  let api;
  let token;

  beforeAll(async () => {
    stack = await startStack();
    api = request(stack.gatewayBaseUrl);
  });

  afterAll(async () => {
    await stack.close();
  });

  test('registers user through gateway auth route', async () => {
    const email = `e109_admin_${Date.now()}@example.com`;

    const res = await api.post('/api/auth/register').send({
      email,
      password: 'Admin@1234!',
      name: 'E109 Admin',
      role: 'admin',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    token = res.body.accessToken;
  });

  test('retrieves project list via protected gateway route', async () => {
    const res = await api
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  test('retrieves project risk score via gateway route', async () => {
    const res = await api
      .get('/api/projects/proj-001/risk-score')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.riskScore.score).toBe('number');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(res.body.riskScore.band);
  });

  test('ingests metrics events and reads summary via gateway route', async () => {
    const ingest = await api
      .post('/api/metrics/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          {
            source: 'github',
            eventType: 'commit',
            projectId: 'proj-001',
            timestamp: new Date().toISOString(),
            severity: 'low',
          },
          {
            source: 'qa',
            eventType: 'test_failure',
            projectId: 'proj-001',
            timestamp: new Date().toISOString(),
            severity: 'critical',
          },
        ],
      });

    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBe(2);

    const summary = await api
      .get('/api/metrics/summary')
      .set('Authorization', `Bearer ${token}`);

    expect(summary.status).toBe(200);
    expect(summary.body.totalEvents).toBeGreaterThanOrEqual(2);
    expect(summary.body.projects).toBeGreaterThanOrEqual(1);
  });

  test('retrieves observability live probe without auth', async () => {
    const res = await api.get('/api/observability/health/live');
    expect(res.status).toBe(200);
  });
});
