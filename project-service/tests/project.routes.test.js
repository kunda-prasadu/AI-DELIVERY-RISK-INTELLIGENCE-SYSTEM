'use strict';

// Must be before any require() so modules see the mock
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const ProjectStore = require('../src/models/project.store');
const EventStore = require('../src/models/event.store');

/**
 * Integration tests for project routes.
 * US-E-103-03
 */

const SECRET = 'dev-secret-change-in-production-min-32-chars!!';

function makeToken(role, permissions) {
  return jwt.sign(
    { sub: 'user-test-01', email: 'test@example.com', role, permissions },
    SECRET,
    { algorithm: 'HS256', expiresIn: '1h' }
  );
}

// Token with full read + write access (admin-like)
const adminToken = makeToken('admin', [
  'projects:read', 'projects:write', 'risk:read', 'events:write', 'users:read',
]);
// Token with read only
const readOnlyToken = makeToken('director', ['projects:read', 'risk:read']);
// Token with no permissions
const noPermToken = makeToken('engineering_lead', []);

beforeEach(() => {
  ProjectStore._reset();
  EventStore._reset();
});

// ── Health ─────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  test('returns 200 without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('project-service');
  });
});

// ── GET /projects ──────────────────────────────────────────────────────────
describe('GET /projects', () => {
  test('returns all projects for authorized user', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(res.body.projects.length).toBe(5);
    expect(res.body.total).toBe(5);
  });

  test('filters by status', async () => {
    const res = await request(app)
      .get('/projects?status=active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.projects.every(p => p.status === 'active')).toBe(true);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });

  test('returns 403 when missing projects:read permission', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${noPermToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /projects/:id ──────────────────────────────────────────────────────
describe('GET /projects/:id', () => {
  test('returns project by id', async () => {
    const res = await request(app)
      .get('/projects/proj-001')
      .set('Authorization', `Bearer ${readOnlyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe('proj-001');
  });

  test('returns 404 for unknown project', async () => {
    const res = await request(app)
      .get('/projects/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /projects/:id/risk-score ───────────────────────────────────────────
describe('GET /projects/:id/risk-score', () => {
  test('returns risk score shape for seeded project', async () => {
    const res = await request(app)
      .get('/projects/proj-001/risk-score')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { riskScore } = res.body;
    expect(riskScore.projectId).toBe('proj-001');
    expect(typeof riskScore.score).toBe('number');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(riskScore.band);
    expect(riskScore.signals).toBeDefined();
    expect(typeof riskScore.eventCount).toBe('number');
  });

  test('read-only token can access risk-score', async () => {
    const res = await request(app)
      .get('/projects/proj-001/risk-score')
      .set('Authorization', `Bearer ${readOnlyToken}`);
    expect(res.status).toBe(200);
  });

  test('returns 404 for unknown project', async () => {
    const res = await request(app)
      .get('/projects/ghost/risk-score')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('returns 403 without risk:read permission', async () => {
    const res = await request(app)
      .get('/projects/proj-001/risk-score')
      .set('Authorization', `Bearer ${noPermToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /projects/:id/insights ─────────────────────────────────────────────
describe('GET /projects/:id/insights', () => {
  test('returns insights with required fields', async () => {
    const res = await request(app)
      .get('/projects/proj-003/insights')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { insights, band, riskScore, generatedAt, pagination } = res.body;
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(band);
    expect(typeof riskScore).toBe('number');
    expect(generatedAt).toBeTruthy();
    expect(pagination).toBeTruthy();
    expect(pagination.page).toBe(1);
    expect(pagination.limit).toBe(10);
  });

  test('every insight has id, severity, title, action', async () => {
    const res = await request(app)
      .get('/projects/proj-001/insights')
      .set('Authorization', `Bearer ${adminToken}`);
    for (const ins of res.body.insights) {
      expect(ins.id).toBeTruthy();
      expect(ins.severity).toBeTruthy();
      expect(ins.title).toBeTruthy();
      expect(ins.action).toBeTruthy();
    }
  });

  test('returns 404 for unknown project', async () => {
    const res = await request(app)
      .get('/projects/ghost/insights')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('filters insights by severity', async () => {
    const res = await request(app)
      .get('/projects/proj-001/insights?severity=CRITICAL')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const ins of res.body.insights) {
      expect(ins.severity).toBe('CRITICAL');
    }
  });

  test('filters insights by domain', async () => {
    const res = await request(app)
      .get('/projects/proj-002/insights?domain=codeVelocity')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    for (const ins of res.body.insights) {
      if (ins.domain !== undefined) expect(ins.domain).toBe('codeVelocity');
    }
  });

  test('supports pagination with page and limit', async () => {
    const res = await request(app)
      .get('/projects/proj-003/insights?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.insights.length).toBeLessThanOrEqual(2);
  });

  test('limits maximum page size to 50', async () => {
    const res = await request(app)
      .get('/projects/proj-001/insights?limit=200')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(50);
  });
});

// ── GET /projects/:id/insights/summary ──────────────────────────────────────
describe('GET /projects/:id/insights/summary', () => {
  test('returns summary with severity and domain counts', async () => {
    const res = await request(app)
      .get('/projects/proj-001/insights/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { severityCounts, domainCounts, totalInsights, riskScore, band } = res.body;
    expect(severityCounts).toBeTruthy();
    expect(severityCounts.INFO).toBeGreaterThanOrEqual(0);
    expect(severityCounts.WARNING).toBeGreaterThanOrEqual(0);
    expect(severityCounts.CRITICAL).toBeGreaterThanOrEqual(0);
    expect(typeof totalInsights).toBe('number');
    expect(typeof riskScore).toBe('number');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(band);
  });

  test('domain counts keys reflect actual domains', async () => {
    const res = await request(app)
      .get('/projects/proj-002/insights/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const { domainCounts } = res.body;
    const domains = Object.keys(domainCounts);
    expect(domains.length).toBeGreaterThan(0);
  });

  test('returns 404 for unknown project', async () => {
    const res = await request(app)
      .get('/projects/unknown-proj/insights/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

// ── GET /projects/:id/recommendations ─────────────────────────────────────
describe('GET /projects/:id/recommendations', () => {
  test('returns recommendations with expected fields', async () => {
    const res = await request(app)
      .get('/projects/proj-001/recommendations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recommendations)).toBe(true);
    expect(res.body.recommendations.length).toBeGreaterThan(0);

    const recommendation = res.body.recommendations[0];
    expect(recommendation.id).toBeTruthy();
    expect(recommendation.priority).toMatch(/^(P1|P2|P3)$/);
    expect(recommendation.ownerRole).toBeTruthy();
    expect(recommendation.title).toBeTruthy();
    expect(recommendation.description).toBeTruthy();
  });

  test('supports priority filter', async () => {
    const res = await request(app)
      .get('/projects/proj-001/recommendations?priority=P1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const recommendation of res.body.recommendations) {
      expect(recommendation.priority).toBe('P1');
    }
  });

  test('supports pagination', async () => {
    const res = await request(app)
      .get('/projects/proj-001/recommendations?page=1&limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(2);
  });

  test('returns 404 for unknown project', async () => {
    const res = await request(app)
      .get('/projects/ghost/recommendations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ── GET /projects/:id/recommendations/summary ─────────────────────────────
describe('GET /projects/:id/recommendations/summary', () => {
  test('returns recommendation summary stats', async () => {
    const res = await request(app)
      .get('/projects/proj-001/recommendations/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.totalRecommendations).toBe('number');
    expect(res.body.priorityCounts).toBeTruthy();
    expect(res.body.ownerRoleCounts).toBeTruthy();
    expect(res.body.domainCounts).toBeTruthy();
  });

  test('returns 404 for unknown project', async () => {
    const res = await request(app)
      .get('/projects/ghost/recommendations/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ── POST /projects ─────────────────────────────────────────────────────────
describe('POST /projects', () => {
  const newProject = {
    name: 'New Test Project',
    description: 'Created in tests',
    status: 'active',
    team: 'backend',
    startDate: '2026-05-01',
    targetDate: '2026-12-31',
  };

  test('creates project and returns 201', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newProject);
    expect(res.status).toBe(201);
    expect(res.body.project.id).toBeTruthy();
    expect(res.body.project.name).toBe('New Test Project');
  });

  test('returns 403 for read-only token', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${readOnlyToken}`)
      .send(newProject);
    expect(res.status).toBe(403);
  });

  test('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'No team' });
    expect(res.status).toBe(400);
  });
});
