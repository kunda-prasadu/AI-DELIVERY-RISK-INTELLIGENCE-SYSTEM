'use strict';

const request = require('supertest');
const app = require('../src/index');
const store = require('../src/models/report.store');

const SAMPLE_PROJECTS = [
  { id: 'p1', name: 'Alpha', riskScore: 85, status: 'at-risk' },
  { id: 'p2', name: 'Beta', riskScore: 45, status: 'active' },
  { id: 'p3', name: 'Gamma', riskScore: 10, status: 'on-track' },
];

beforeEach(() => store.clear());

describe('GET /health/live', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /health/ready', () => {
  it('returns 200 ready', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('POST /reports/generate', () => {
  it('generates an executive-summary report', async () => {
    const res = await request(app)
      .post('/reports/generate')
      .send({
        reportType: 'executive-summary',
        requestedBy: 'cto@example.com',
        projects: SAMPLE_PROJECTS,
        openInsights: 12,
        openRecommendations: 5,
        anomalyCount: 3,
      });
    expect(res.status).toBe(201);
    expect(res.body.report.reportType).toBe('executive-summary');
    expect(res.body.report.reportId).toBeDefined();
    expect(res.body.report.sections.executiveSummary.portfolioHealth.totalProjects).toBe(3);
    expect(res.body.report.sections.topRisks[0].projectName).toBe('Alpha');
  });

  it('defaults reportType to executive-summary when omitted', async () => {
    const res = await request(app).post('/reports/generate').send({});
    expect(res.status).toBe(201);
    expect(res.body.report.reportType).toBe('executive-summary');
  });

  it('returns 400 for invalid reportType', async () => {
    const res = await request(app)
      .post('/reports/generate')
      .send({ reportType: 'unknown-type' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid project entry (missing name)', async () => {
    const res = await request(app)
      .post('/reports/generate')
      .send({
        projects: [{ id: 'p1' }], // missing name
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /reports', () => {
  it('returns empty list when no reports generated', async () => {
    const res = await request(app).get('/reports');
    expect(res.status).toBe(200);
    expect(res.body.reports).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('lists reports after generation', async () => {
    await request(app).post('/reports/generate').send({ requestedBy: 'pm@example.com' });
    await request(app).post('/reports/generate').send({ requestedBy: 'cto@example.com' });

    const res = await request(app).get('/reports');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('filters by requestedBy', async () => {
    await request(app).post('/reports/generate').send({ requestedBy: 'pm@example.com' });
    await request(app).post('/reports/generate').send({ requestedBy: 'cto@example.com' });

    const res = await request(app).get('/reports?requestedBy=pm@example.com');
    expect(res.status).toBe(200);
    expect(res.body.reports.every((r) => r.requestedBy === 'pm@example.com')).toBe(true);
  });
});

describe('GET /reports/:reportId', () => {
  it('retrieves a report by id', async () => {
    const gen = await request(app).post('/reports/generate').send({ requestedBy: 'admin' });
    const { reportId } = gen.body.report;

    const res = await request(app).get(`/reports/${reportId}`);
    expect(res.status).toBe(200);
    expect(res.body.report.reportId).toBe(reportId);
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/reports/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

describe('GET /reports/:reportId/markdown', () => {
  it('returns markdown with correct content-type', async () => {
    const gen = await request(app).post('/reports/generate').send({
      projects: SAMPLE_PROJECTS,
      requestedBy: 'test',
    });
    const { reportId } = gen.body.report;

    const res = await request(app).get(`/reports/${reportId}/markdown`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/markdown/);
    expect(res.text).toContain('Executive Report');
  });

  it('returns 404 markdown for unknown id', async () => {
    const res = await request(app).get('/reports/bad-id/markdown');
    expect(res.status).toBe(404);
  });
});
