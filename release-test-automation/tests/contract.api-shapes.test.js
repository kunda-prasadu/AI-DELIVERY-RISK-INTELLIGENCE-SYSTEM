'use strict';

const Joi = require('joi');
const request = require('supertest');
const { startStack } = require('./utils/stack.harness');

const authRegisterSchema = Joi.object({
  user: Joi.object({ id: Joi.string().required(), email: Joi.string().email().required(), role: Joi.string().required() }).unknown(true).required(),
  accessToken: Joi.string().required(),
  refreshToken: Joi.string().required(),
}).unknown(true);

const projectsSchema = Joi.object({
  projects: Joi.array().items(Joi.object({ id: Joi.string().required(), name: Joi.string().required() }).unknown(true)).required(),
  total: Joi.number().integer().min(0).required(),
}).unknown(true);

const riskScoreSchema = Joi.object({
  riskScore: Joi.object({
    projectId: Joi.string().required(),
    score: Joi.number().required(),
    band: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').required(),
    signals: Joi.object().required(),
    eventCount: Joi.number().required(),
  }).unknown(true).required(),
}).unknown(true);

const metricsSummarySchema = Joi.object({
  totalEvents: Joi.number().integer().min(0).required(),
  projects: Joi.number().integer().min(0).required(),
  projectsWithCritical: Joi.number().integer().min(0).required(),
  projectsWithHigh: Joi.number().integer().min(0).required(),
  lastUpdated: Joi.alternatives().try(Joi.string().isoDate(), Joi.allow(null)).required(),
}).unknown(true);

describe('E-109 contract: gateway response schemas', () => {
  let stack;
  let api;
  let token;

  beforeAll(async () => {
    stack = await startStack();
    api = request(stack.gatewayBaseUrl);

    const reg = await api.post('/api/auth/register').send({
      email: `e109_contract_${Date.now()}@example.com`,
      password: 'Admin@1234!',
      name: 'Contract Admin',
      role: 'admin',
    });
    token = reg.body.accessToken;
  });

  afterAll(async () => {
    await stack.close();
  });

  test('auth register response matches schema', async () => {
    const res = await api.post('/api/auth/register').send({
      email: `e109_contract_2_${Date.now()}@example.com`,
      password: 'Admin@1234!',
      name: 'Contract Admin 2',
      role: 'admin',
    });

    const { error } = authRegisterSchema.validate(res.body);
    expect(res.status).toBe(201);
    expect(error).toBeUndefined();
  });

  test('projects response matches schema', async () => {
    const res = await api.get('/api/projects').set('Authorization', `Bearer ${token}`);

    const { error } = projectsSchema.validate(res.body);
    expect(res.status).toBe(200);
    expect(error).toBeUndefined();
  });

  test('risk-score response matches schema', async () => {
    const res = await api
      .get('/api/projects/proj-001/risk-score')
      .set('Authorization', `Bearer ${token}`);

    const { error } = riskScoreSchema.validate(res.body);
    expect(res.status).toBe(200);
    expect(error).toBeUndefined();
  });

  test('metrics summary response matches schema', async () => {
    await api
      .post('/api/metrics/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        events: [
          {
            source: 'jira',
            eventType: 'issue_created',
            projectId: 'proj-001',
            timestamp: new Date().toISOString(),
            severity: 'medium',
          },
        ],
      });

    const res = await api.get('/api/metrics/summary').set('Authorization', `Bearer ${token}`);
    const { error } = metricsSummarySchema.validate(res.body);

    expect(res.status).toBe(200);
    expect(error).toBeUndefined();
  });
});
