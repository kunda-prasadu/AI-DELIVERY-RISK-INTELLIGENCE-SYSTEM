'use strict';

const jwt = require('jsonwebtoken');
const config = require('../src/config/gateway.config');
const {
  extractBearerToken,
  optionalAuth,
  requireAuth,
} = require('../src/middleware/auth.middleware');

describe('auth.middleware', () => {
  test('extractBearerToken returns null for invalid header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Basic abc')).toBeNull();
  });

  test('extractBearerToken extracts token', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  test('optionalAuth sets user when token valid', () => {
    const token = jwt.sign({ id: 'u1', role: 'admin' }, config.jwtSecret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();

    optionalAuth(req, {}, next);

    expect(req.user.id).toBe('u1');
    expect(next).toHaveBeenCalled();
  });

  test('optionalAuth does not block invalid token', () => {
    const req = { headers: { authorization: 'Bearer badtoken' } };
    const next = jest.fn();

    optionalAuth(req, {}, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test('requireAuth returns 401 when missing token', () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    requireAuth(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing Bearer token' });
  });

  test('requireAuth returns 401 when token invalid', () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    requireAuth(req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('requireAuth passes when token valid', () => {
    const token = jwt.sign({ id: 'u2', role: 'director' }, config.jwtSecret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.user.id).toBe('u2');
    expect(next).toHaveBeenCalled();
  });
});
