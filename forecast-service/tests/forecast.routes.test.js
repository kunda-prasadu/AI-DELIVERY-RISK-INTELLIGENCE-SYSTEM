const request = require('supertest');
const app = require('../src/index');
const { store } = require('../src/models/forecast.store');

beforeEach(() => store.clear());

const completionPayload = {
  forecastType: 'COMPLETION',
  projectId: 'p1',
  projectName: 'Alpha',
  remainingPoints: 80,
  sprintVelocities: [40, 42, 38, 41],
};

const riskTrendPayload = {
  forecastType: 'RISK_TREND',
  projectId: 'p2',
  projectName: 'Beta',
  riskHistory: [
    { date: '2026-03-01', score: 30 },
    { date: '2026-03-08', score: 45 },
    { date: '2026-03-15', score: 60 },
  ],
  weeksAhead: 4,
};

const velocityPayload = {
  forecastType: 'VELOCITY',
  projectId: 'p3',
  projectName: 'Gamma',
  sprintVelocities: [35, 38, 40, 42],
  sprintsAhead: 3,
};

const portfolioPayload = {
  forecastType: 'PORTFOLIO',
  projects: [
    {
      projectId: 'p1',
      projectName: 'Alpha',
      remainingPoints: 60,
      sprintVelocities: [30, 31, 29, 30],
      riskHistory: [
        { date: '2026-03-01', score: 25 },
        { date: '2026-03-08', score: 28 },
      ],
    },
    {
      projectId: 'p2',
      projectName: 'Beta',
      remainingPoints: 120,
      sprintVelocities: [20, 15, 25, 18],
      riskHistory: [
        { date: '2026-03-01', score: 50 },
        { date: '2026-03-08', score: 65 },
        { date: '2026-03-15', score: 80 },
      ],
    },
  ],
};

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /forecasts/generate', () => {
  it('201 — COMPLETION forecast', async () => {
    const res = await request(app).post('/forecasts/generate').send(completionPayload);
    expect(res.status).toBe(201);
    expect(res.body.forecastType).toBe('COMPLETION');
    expect(res.body.forecastId).toBeDefined();
    expect(res.body.estimatedCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('201 — RISK_TREND forecast', async () => {
    const res = await request(app).post('/forecasts/generate').send(riskTrendPayload);
    expect(res.status).toBe(201);
    expect(res.body.forecastType).toBe('RISK_TREND');
    expect(res.body.projections.length).toBe(4);
  });

  it('201 — VELOCITY forecast', async () => {
    const res = await request(app).post('/forecasts/generate').send(velocityPayload);
    expect(res.status).toBe(201);
    expect(res.body.forecastType).toBe('VELOCITY');
    expect(res.body.projections.length).toBe(3);
  });

  it('201 — PORTFOLIO forecast', async () => {
    const res = await request(app).post('/forecasts/generate').send(portfolioPayload);
    expect(res.status).toBe(201);
    expect(res.body.forecastType).toBe('PORTFOLIO');
    expect(res.body.totalProjects).toBe(2);
    expect(Array.isArray(res.body.completionForecasts)).toBe(true);
    expect(res.body.summary).toBeDefined();
  });

  it('400 for unknown forecastType', async () => {
    const res = await request(app).post('/forecasts/generate').send({ forecastType: 'BOGUS' });
    expect(res.status).toBe(400);
  });

  it('422 for missing required fields', async () => {
    const res = await request(app).post('/forecasts/generate').send({
      forecastType: 'COMPLETION',
      projectId: 'px',
      // missing remainingPoints and sprintVelocities
    });
    expect(res.status).toBe(422);
    expect(res.body.details).toBeDefined();
  });
});

describe('GET /forecasts', () => {
  it('returns empty list initially', async () => {
    const res = await request(app).get('/forecasts');
    expect(res.status).toBe(200);
    expect(res.body.forecasts).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('lists saved forecasts', async () => {
    await request(app).post('/forecasts/generate').send(completionPayload);
    await request(app).post('/forecasts/generate').send(riskTrendPayload);
    const res = await request(app).get('/forecasts');
    expect(res.body.total).toBe(2);
  });

  it('filters by forecastType', async () => {
    await request(app).post('/forecasts/generate').send(completionPayload);
    await request(app).post('/forecasts/generate').send(riskTrendPayload);
    const res = await request(app).get('/forecasts?forecastType=COMPLETION');
    expect(res.body.total).toBe(1);
    expect(res.body.forecasts[0].forecastType).toBe('COMPLETION');
  });

  it('filters by projectId', async () => {
    await request(app).post('/forecasts/generate').send(completionPayload);
    const res = await request(app).get('/forecasts?projectId=p1');
    expect(res.body.total).toBe(1);
  });
});

describe('GET /forecasts/:forecastId', () => {
  it('returns the forecast by id', async () => {
    const create = await request(app).post('/forecasts/generate').send(completionPayload);
    const { forecastId } = create.body;
    const res = await request(app).get(`/forecasts/${forecastId}`);
    expect(res.status).toBe(200);
    expect(res.body.forecastId).toBe(forecastId);
  });

  it('404 for unknown id', async () => {
    const res = await request(app).get('/forecasts/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
