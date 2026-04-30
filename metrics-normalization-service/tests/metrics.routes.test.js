'use strict';

const express = require('express');
const request = require('supertest');
const metricsRoutes = require('../src/routes/metrics.routes');
const aggregator = require('../src/models/metrics.aggregator');
const orchestrator = require('../src/models/pipeline.orchestrator');

describe('metrics.routes', () => {
  let app;

  beforeEach(() => {
    aggregator._reset();
    orchestrator.previousSnapshot = new Map();
    orchestrator.snapshotHistory = new Map();

    app = express();
    app.use(express.json());
    app.use('/metrics', metricsRoutes);
  });

  test('POST /metrics/events ingests events and reports rejected', async () => {
    const res = await request(app)
      .post('/metrics/events')
      .send({
        events: [
          {
            source: 'github',
            eventType: 'commit',
            projectId: 'p1',
            timestamp: '2026-04-29T10:00:00.000Z',
            severity: 'low',
          },
          {
            source: 'unknown-source',
            eventType: 'x',
            projectId: 'p1',
            timestamp: '2026-04-29T10:00:00.000Z',
            severity: 'low',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(2);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(1);
  });

  test('GET /metrics/projects/:projectId returns project metrics', async () => {
    aggregator.ingest({
      source: 'jira',
      eventType: 'issue_blocked',
      projectId: 'p2',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'high',
    });

    const res = await request(app).get('/metrics/projects/p2');
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe('p2');
    expect(res.body.totalEvents).toBe(1);
  });

  test('GET /metrics/projects/:projectId returns 404 when missing', async () => {
    const res = await request(app).get('/metrics/projects/missing');
    expect(res.status).toBe(404);
  });

  test('GET /metrics/projects returns all projects', async () => {
    aggregator.ingest({
      source: 'jira',
      eventType: 'issue_created',
      projectId: 'p1',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'low',
    });
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p2',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });

    const res = await request(app).get('/metrics/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test('GET /metrics/summary returns aggregate values', async () => {
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p2',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });

    const res = await request(app).get('/metrics/summary');
    expect(res.status).toBe(200);
    expect(res.body.totalEvents).toBe(1);
    expect(res.body.projects).toBe(1);
    expect(res.body.projectsWithCritical).toBe(1);
  });

  test('GET /metrics/projects/:projectId/trend returns trend output', async () => {
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p3',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });
    orchestrator.captureSnapshot();

    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p3',
      timestamp: '2026-04-29T10:05:00.000Z',
      severity: 'critical',
    });

    const res = await request(app).get('/metrics/projects/p3/trend');
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe('p3');
    expect(res.body.trend).toBe('regression');
  });

  test('GET /metrics/projects/:projectId/anomalies returns classified anomaly details', async () => {
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p4',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });
    orchestrator.captureSnapshot();

    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p4',
      timestamp: '2026-04-29T10:05:00.000Z',
      severity: 'critical',
    });
    aggregator.ingest({
      source: 'jira',
      eventType: 'issue_blocked',
      projectId: 'p4',
      timestamp: '2026-04-29T10:06:00.000Z',
      severity: 'high',
    });

    const res = await request(app).get('/metrics/projects/p4/anomalies');
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe('p4');
    expect(res.body.severity).toBe('CRITICAL');
    expect(res.body.trend).toBe('regression');
    expect(res.body.reasons.length).toBeGreaterThan(0);
  });

  test('GET /metrics/anomalies returns portfolio anomaly list sorted by score', async () => {
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p-low',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'medium',
    });

    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p-high',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });
    aggregator.ingest({
      source: 'jira',
      eventType: 'issue_blocked',
      projectId: 'p-high',
      timestamp: '2026-04-29T10:01:00.000Z',
      severity: 'high',
    });

    const res = await request(app).get('/metrics/anomalies');
    expect(res.status).toBe(200);
    expect(res.body.totalProjects).toBe(2);
    expect(res.body.anomalies[0].projectId).toBe('p-high');
    expect(res.body.anomalies[0].anomalyScore).toBeGreaterThanOrEqual(res.body.anomalies[1].anomalyScore);
  });

  test('GET /metrics/projects/:projectId/risk-trend returns 404 when no history', async () => {
    const res = await request(app).get('/metrics/projects/unknown-proj/risk-trend');
    expect(res.status).toBe(404);
  });

  test('GET /metrics/projects/:projectId/risk-trend returns trend after snapshots captured', async () => {
    // First snapshot — 1 critical event
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p-trend',
      timestamp: '2026-04-29T10:00:00.000Z',
      severity: 'critical',
    });
    orchestrator.captureSnapshot();

    // Second snapshot — 3 critical events
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p-trend',
      timestamp: '2026-04-29T10:05:00.000Z',
      severity: 'critical',
    });
    aggregator.ingest({
      source: 'qa',
      eventType: 'test_failure',
      projectId: 'p-trend',
      timestamp: '2026-04-29T10:06:00.000Z',
      severity: 'critical',
    });
    orchestrator.captureSnapshot();

    const res = await request(app).get('/metrics/projects/p-trend/risk-trend');
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe('p-trend');
    expect(res.body.snapshots).toHaveLength(2);
    expect(res.body.trend).toBe('worsening');
    expect(res.body.deltaScore).toBeGreaterThan(0);
    expect(res.body.snapshots[0]).toHaveProperty('riskScore');
    expect(res.body.snapshots[0]).toHaveProperty('band');
  });
});
