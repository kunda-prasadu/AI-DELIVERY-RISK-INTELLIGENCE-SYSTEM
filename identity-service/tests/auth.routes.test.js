'use strict';

// Must be before any require() so modules see the mock
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const request = require('supertest');
const AuditStore = require('../src/models/audit.store');
const UserStore = require('../src/models/user.store');
const { ROLES } = require('../src/models/rbac.model');

/**
 * Integration tests for auth routes — register, login, refresh, logout, me, users.
 * US-E-102-03
 */

// Build a minimal test app without starting a server
const express = require('express');
const authRoutes = require('../src/routes/auth.routes');
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

beforeEach(() => {
  UserStore._reset();
  AuditStore.clear();
});

const adminUser = {
  email: 'admin@test.com',
  password: 'Admin@1234!',
  name: 'Admin User',
  role: ROLES.ADMIN,
};

const regularUser = {
  email: 'dev@test.com',
  password: 'Devpass@1!',
  name: 'Dev Lead',
  role: ROLES.ENGINEERING_LEAD,
};

// ── POST /auth/register ────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  test('registers a new user and returns tokens', async () => {
    const res = await request(app).post('/auth/register').send(adminUser);
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('admin@test.com');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('returns 409 for duplicate email', async () => {
    await request(app).post('/auth/register').send(adminUser);
    const res = await request(app).post('/auth/register').send(adminUser);
    expect(res.status).toBe(409);
  });

  test('returns 400 for weak password', async () => {
    const res = await request(app).post('/auth/register').send({ ...adminUser, password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid email', async () => {
    const res = await request(app).post('/auth/register').send({ ...adminUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid role', async () => {
    const res = await request(app).post('/auth/register').send({ ...adminUser, role: 'superuser' });
    expect(res.status).toBe(400);
  });
});

// ── POST /auth/login ───────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register').send(adminUser);
  });

  test('returns tokens on valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({
      email: adminUser.email, password: adminUser.password, mfaCode: '123456',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  test('returns 401 for privileged role login without MFA code', async () => {
    const res = await request(app).post('/auth/login').send({
      email: adminUser.email, password: adminUser.password,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/MFA/);
  });

  test('returns 401 for wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: adminUser.email, password: 'WrongPass@1!',
    });
    expect(res.status).toBe(401);
  });

  test('returns 401 for unknown email', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'nobody@test.com', password: 'SomePass@1!',
    });
    expect(res.status).toBe(401);
  });

  test('does not reveal whether email exists (same 401 response)', async () => {
    const knownRes = await request(app).post('/auth/login').send({
      email: adminUser.email, password: 'Wrong@1!',
    });
    const unknownRes = await request(app).post('/auth/login').send({
      email: 'ghost@test.com', password: 'Wrong@1!',
    });
    expect(knownRes.status).toBe(unknownRes.status);
    expect(knownRes.body.error).toBe(unknownRes.body.error);
  });
});

// ── GET /auth/me ───────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  let accessToken;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send(regularUser);
    accessToken = res.body.accessToken;
  });

  test('returns user profile and permissions with valid token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('dev@test.com');
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns 401 for malformed token', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  let refreshToken;

  beforeEach(async () => {
    const res = await request(app).post('/auth/register').send(regularUser);
    refreshToken = res.body.refreshToken;
  });

  test('returns new accessToken for valid refreshToken', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  test('returns 401 for revoked refreshToken', async () => {
    // logout revokes the token
    const loginRes = await request(app).post('/auth/login').send({
      email: regularUser.email, password: regularUser.password,
    });
    await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send({ refreshToken: loginRes.body.refreshToken });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: loginRes.body.refreshToken });
    expect(res.status).toBe(401);
  });
});

// ── GET /auth/users (admin only) ───────────────────────────────────────────

describe('GET /auth/users', () => {
  let adminToken, regularToken;

  beforeEach(async () => {
    const a = await request(app).post('/auth/register').send(adminUser);
    adminToken = a.body.accessToken;
    const r = await request(app).post('/auth/register').send(regularUser);
    regularToken = r.body.accessToken;
  });

  test('admin can list all users', async () => {
    const res = await request(app)
      .get('/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('non-admin gets 403', async () => {
    const res = await request(app)
      .get('/auth/users')
      .set('Authorization', `Bearer ${regularToken}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /auth/audit', () => {
  let adminToken, regularToken;

  beforeEach(async () => {
    const adminRes = await request(app).post('/auth/register').send(adminUser);
    adminToken = adminRes.body.accessToken;

    const regularRes = await request(app).post('/auth/register').send(regularUser);
    regularToken = regularRes.body.accessToken;

    await request(app).post('/auth/login').send({
      email: regularUser.email,
      password: regularUser.password,
    });
  });

  test('admin can read audit entries with integrity summary', async () => {
    const res = await request(app)
      .get('/auth/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.integrity.valid).toBe(true);
    expect(res.body.entries.some((entry) => entry.action === 'auth.login')).toBe(true);
  });

  test('supports filtering audit entries by action', async () => {
    const res = await request(app)
      .get('/auth/audit?action=auth.login')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries.every((entry) => entry.action === 'auth.login')).toBe(true);
  });

  test('non-admin without audit permission gets 403', async () => {
    const res = await request(app)
      .get('/auth/audit')
      .set('Authorization', `Bearer ${regularToken}`);

    expect(res.status).toBe(403);
  });
});
