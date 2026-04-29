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

    const token = jwt.sign({ id: 'u1', role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });
    const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(axios).toHaveBeenCalled();
  });

  test('observability route does not require auth', async () => {
    axios.mockResolvedValue({ status: 200, data: { status: 'ok' }, headers: {} });

    const res = await request(app).get('/api/observability/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
