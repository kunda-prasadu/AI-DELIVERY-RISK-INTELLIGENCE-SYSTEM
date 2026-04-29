'use strict';

const express = require('express');
const request = require('supertest');
const axios = require('axios');
const { createProxyHandler, buildForwardHeaders } = require('../src/routes/proxy.routes');

jest.mock('axios');

describe('proxy.routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/projects', createProxyHandler('http://project-service:3002', '/api/projects'));
  });

  test('buildForwardHeaders propagates authorization', () => {
    const headers = buildForwardHeaders({
      headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
    });

    expect(headers.Authorization).toBe('Bearer t');
    expect(headers['X-Forwarded-By']).toBe('api-gateway-service');
  });

  test('forwards GET request to upstream with stripped path', async () => {
    axios.mockResolvedValue({ status: 200, data: { ok: true }, headers: { 'x-test': '1' } });

    const res = await request(app).get('/api/projects/p1?expand=true').set('Authorization', 'Bearer abc');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(axios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'http://project-service:3002/p1',
        params: { expand: 'true' },
      })
    );
  });

  test('forwards POST body to upstream', async () => {
    axios.mockResolvedValue({ status: 201, data: { created: true }, headers: {} });

    const payload = { status: 'IN_PROGRESS' };
    const res = await request(app).post('/api/projects/p2/status').send(payload);

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(true);
    expect(axios).toHaveBeenCalledWith(expect.objectContaining({ data: payload }));
  });

  test('returns upstream error payload/status when response exists', async () => {
    axios.mockResolvedValue({ status: 404, data: { error: 'not found' }, headers: {} });

    const res = await request(app).get('/api/projects/missing');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});
