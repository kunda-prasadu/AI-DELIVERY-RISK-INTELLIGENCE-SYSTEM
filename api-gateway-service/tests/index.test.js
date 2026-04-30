'use strict';

jest.mock('express-rate-limit', () => jest.fn(() => (req, _res, next) => next()));
jest.mock('axios');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const config = require('../src/config/gateway.config');
const app = require('../src/index');

describe('gateway index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('api-gateway-service');
  });

  test('projects route requires auth', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(401);
  });

  test('metrics route requires auth', async () => {
    const res = await request(app).get('/api/metrics/summary');
    expect(res.status).toBe(401);
  });

  test('auth route proxies without auth requirement', async () => {
    axios.mockResolvedValue({ status: 200, data: { token: 'x' }, headers: {} });

    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com', password: 'P@ssw0rd!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('x');
  });

  test('projects route proxies when token valid', async () => {
    axios.mockResolvedValue({ status: 200, data: [{ id: 'p1' }], headers: {} });

    const token = jwt.sign({ id: 'u1', role: 'admin', mfaVerified: true }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(axios).toHaveBeenCalled();
  });

  test('feedback route proxies when token valid', async () => {
    axios.mockResolvedValue({ status: 200, data: { learning: { total: 0 } }, headers: {} });

    const token = jwt.sign({ id: 'u1', role: 'admin', mfaVerified: true }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app).get('/api/feedback/learning').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.learning.total).toBe(0);
  });

  test('reports route requires auth', async () => {
    const res = await request(app).get('/api/reports');
    expect(res.status).toBe(401);
  });

  test('forecasts route requires auth', async () => {
    const res = await request(app).get('/api/forecasts');
    expect(res.status).toBe(401);
  });

  test('agent workbench aggregates project, feedback, reporting, and forecast services', async () => {
    axios
      .mockResolvedValueOnce({
        status: 200,
        data: {
          workbench: {
            projectId: 'proj-001',
            projectName: 'Payments Gateway',
            team: 'Core Platform',
            riskScore: 72,
            band: 'HIGH',
            generatedAt: new Date().toISOString(),
            agents: [
              { key: 'feedback-learning', name: 'Feedback Learning Agent', status: 'READY', summary: { loopState: 'feedback-enabled' } },
            ],
            summaries: {
              insights: { totalInsights: 3, severityCounts: { INFO: 0, WARNING: 2, CRITICAL: 1 }, domainCounts: { cicd: 1 } },
              recommendations: { totalRecommendations: 2, priorityCounts: { P1: 1, P2: 1, P3: 0 }, ownerRoleCounts: {}, domainCounts: {} },
            },
            previews: { insights: [], recommendations: [] },
            nextActions: [],
          },
        },
        headers: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          learning: {
            total: 4,
            acceptanceRate: 75,
            topRejected: [{ targetId: 'REC-1', count: 1 }],
          },
        },
        headers: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          reports: [{ reportType: 'executive-summary', sections: { executiveSummary: { overallRag: 'AMBER', openRecommendations: 6 } } }],
          total: 1,
        },
        headers: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          forecasts: [{ forecastType: 'PORTFOLIO', summary: { atRiskCount: 3, worseningCount: 2 } }],
          total: 1,
        },
        headers: {},
      });

    const token = jwt.sign({ id: 'u1', role: 'admin', mfaVerified: true }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/agents/projects/proj-001/workbench?insightLimit=2')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.workbench.projectId).toBe('proj-001');
    expect(res.body.workbench.serviceStatus.feedback).toBe('connected');
    expect(res.body.workbench.feedbackLearning.total).toBe(4);
    expect(res.body.workbench.latestReport.reportType).toBe('executive-summary');
    expect(res.body.workbench.latestForecast.forecastType).toBe('PORTFOLIO');
    expect(res.body.workbench.agents.some((agent) => agent.key === 'prediction')).toBe(true);
    expect(res.body.workbench.agents.some((agent) => agent.key === 'reporting')).toBe(true);
  });

  test('projects route blocks privileged token without MFA claim', async () => {
    const token = jwt.sign({ id: 'u1', role: 'admin', mfaVerified: false }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/MFA required/);
  });

  test('observability route does not require auth', async () => {
    axios.mockResolvedValue({ status: 200, data: { status: 'ok' }, headers: {} });

    const res = await request(app).get('/api/observability/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
