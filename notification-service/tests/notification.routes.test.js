'use strict';

const request = require('supertest');
const app = require('../src/index');
const store = require('../src/models/notification.store');

describe('Notification Service Routes', () => {
  beforeEach(() => {
    store.clear();
  });

  test('POST /notifications/send dispatches a single notification', async () => {
    const res = await request(app)
      .post('/notifications/send')
      .send({
        projectId: 'proj-001',
        channel: 'email',
        recipient: 'owner@example.com',
        message: 'Risk threshold exceeded.',
      });

    expect(res.status).toBe(201);
    expect(res.body.notification.id).toBeTruthy();
    expect(res.body.notification.channel).toBe('email');
  });

  test('POST /notifications/send returns 400 for invalid channel', async () => {
    const res = await request(app)
      .post('/notifications/send')
      .send({
        projectId: 'proj-001',
        channel: 'sms',
        recipient: 'owner@example.com',
        message: 'Risk threshold exceeded.',
      });

    expect(res.status).toBe(400);
  });

  test('POST /notifications/broadcast dispatches to multiple channels', async () => {
    const res = await request(app)
      .post('/notifications/broadcast')
      .send({
        projectId: 'proj-001',
        channels: ['email', 'slack', 'teams'],
        recipient: '#delivery-alerts',
        message: 'Deployment risk increased.',
      });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(3);
  });

  test('GET /notifications/history returns all sent notifications', async () => {
    await request(app).post('/notifications/send').send({
      projectId: 'proj-001',
      channel: 'email',
      recipient: 'owner@example.com',
      message: 'Risk threshold exceeded.',
    });

    await request(app).post('/notifications/send').send({
      projectId: 'proj-002',
      channel: 'slack',
      recipient: '#alerts',
      message: 'Build failure detected.',
    });

    const res = await request(app).get('/notifications/history');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  test('GET /notifications/history filters by projectId and channel', async () => {
    await request(app).post('/notifications/send').send({
      projectId: 'proj-001',
      channel: 'email',
      recipient: 'owner@example.com',
      message: 'Risk threshold exceeded.',
    });

    await request(app).post('/notifications/send').send({
      projectId: 'proj-001',
      channel: 'slack',
      recipient: '#alerts',
      message: 'Build failure detected.',
    });

    const res = await request(app).get('/notifications/history?projectId=proj-001&channel=email');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.notifications[0].channel).toBe('email');
  });

  test('health endpoints are available', async () => {
    const live = await request(app).get('/health/live');
    const ready = await request(app).get('/health/ready');

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(live.body.service).toBe('notification-service');
  });
});
