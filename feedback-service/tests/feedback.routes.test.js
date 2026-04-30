'use strict';

const request = require('supertest');
const app = require('../src/index');
const { store } = require('../src/models/feedback.store');

beforeEach(() => store.clear());

describe('GET /health/live', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /health/ready', () => {
  it('returns 200', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('POST /feedback', () => {
  it('creates a feedback entry', async () => {
    const res = await request(app).post('/feedback').send({
      projectId: 'p1',
      targetType: 'recommendation',
      targetId: 'r1',
      signal: 'accepted',
      submittedBy: 'pm@example.com',
      comment: 'Good suggestion',
    });
    expect(res.status).toBe(201);
    expect(res.body.feedback.feedbackId).toBeDefined();
    expect(res.body.feedback.signal).toBe('accepted');
    expect(res.body.feedback.createdAt).toBeDefined();
  });

  it('defaults submittedBy to anonymous', async () => {
    const res = await request(app).post('/feedback').send({
      projectId: 'p1',
      targetType: 'insight',
      targetId: 'i1',
      signal: 'rejected',
    });
    expect(res.status).toBe(201);
    expect(res.body.feedback.submittedBy).toBe('anonymous');
  });

  it('accepts corrected signal with correctedValue', async () => {
    const res = await request(app).post('/feedback').send({
      projectId: 'p1',
      targetType: 'recommendation',
      targetId: 'r1',
      signal: 'corrected',
      correctedValue: 'P1',
    });
    expect(res.status).toBe(201);
    expect(res.body.feedback.correctedValue).toBe('P1');
  });

  it('returns 400 for unknown signal', async () => {
    const res = await request(app).post('/feedback').send({
      projectId: 'p1',
      targetType: 'recommendation',
      targetId: 'r1',
      signal: 'unknown-signal',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for unknown targetType', async () => {
    const res = await request(app).post('/feedback').send({
      projectId: 'p1',
      targetType: 'invalid-type',
      targetId: 'r1',
      signal: 'accepted',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/feedback').send({ projectId: 'p1' });
    expect(res.status).toBe(400);
  });
});

describe('GET /feedback', () => {
  beforeEach(async () => {
    await request(app).post('/feedback').send({ projectId: 'p1', targetType: 'recommendation', targetId: 'r1', signal: 'accepted' });
    await request(app).post('/feedback').send({ projectId: 'p1', targetType: 'insight', targetId: 'i1', signal: 'rejected' });
    await request(app).post('/feedback').send({ projectId: 'p2', targetType: 'anomaly', targetId: 'a1', signal: 'deferred' });
  });

  it('returns all entries', async () => {
    const res = await request(app).get('/feedback');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it('filters by projectId', async () => {
    const res = await request(app).get('/feedback?projectId=p1');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.feedback.every((e) => e.projectId === 'p1')).toBe(true);
  });

  it('filters by signal', async () => {
    const res = await request(app).get('/feedback?signal=rejected');
    expect(res.body.total).toBe(1);
    expect(res.body.feedback[0].signal).toBe('rejected');
  });

  it('filters by targetType', async () => {
    const res = await request(app).get('/feedback?targetType=anomaly');
    expect(res.body.total).toBe(1);
    expect(res.body.feedback[0].targetType).toBe('anomaly');
  });
});

describe('GET /feedback/learning', () => {
  beforeEach(async () => {
    await request(app).post('/feedback').send({ projectId: 'p1', targetType: 'recommendation', targetId: 'r1', signal: 'accepted' });
    await request(app).post('/feedback').send({ projectId: 'p1', targetType: 'recommendation', targetId: 'r2', signal: 'rejected' });
    await request(app).post('/feedback').send({ projectId: 'p2', targetType: 'insight', targetId: 'i1', signal: 'accepted' });
  });

  it('returns aggregated learning summary', async () => {
    const res = await request(app).get('/feedback/learning');
    expect(res.status).toBe(200);
    expect(res.body.learning.total).toBe(3);
    expect(res.body.learning.signalCounts).toBeDefined();
    expect(res.body.learning.acceptanceRate).toBeDefined();
  });

  it('scopes learning to projectId', async () => {
    const res = await request(app).get('/feedback/learning?projectId=p1');
    expect(res.body.learning.total).toBe(2);
    expect(res.body.learning.signalCounts.accepted).toBe(1);
    expect(res.body.learning.signalCounts.rejected).toBe(1);
  });
});

describe('GET /feedback/:feedbackId', () => {
  it('retrieves entry by id', async () => {
    const post = await request(app).post('/feedback').send({
      projectId: 'p1',
      targetType: 'report',
      targetId: 'rpt-1',
      signal: 'deferred',
    });
    const id = post.body.feedback.feedbackId;

    const res = await request(app).get(`/feedback/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.feedback.feedbackId).toBe(id);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/feedback/nonexistent');
    expect(res.status).toBe(404);
  });
});
