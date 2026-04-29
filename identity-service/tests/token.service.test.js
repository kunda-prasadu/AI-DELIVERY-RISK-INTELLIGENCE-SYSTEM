'use strict';

const TokenService = require('../src/models/token.service');
const { ROLES, getPermissionsForRole } = require('../src/models/rbac.model');

/**
 * Unit tests for TokenService — issue, verify, refresh tokens.
 * US-E-102-03
 */

const mockUser = {
  id: 'user-001',
  email: 'bob@example.com',
  role: ROLES.ENGINEERING_LEAD,
};

describe('TokenService.issueAccessToken', () => {
  test('issues a non-empty JWT string', () => {
    const token = TokenService.issueAccessToken(mockUser, []);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // header.payload.signature
  });

  test('payload contains correct sub, email, role', () => {
    const permissions = getPermissionsForRole(mockUser.role);
    const token = TokenService.issueAccessToken(mockUser, permissions);
    const decoded = TokenService.decode(token);
    expect(decoded.sub).toBe('user-001');
    expect(decoded.email).toBe('bob@example.com');
    expect(decoded.role).toBe(ROLES.ENGINEERING_LEAD);
    expect(Array.isArray(decoded.permissions)).toBe(true);
    expect(decoded.permissions.length).toBeGreaterThan(0);
  });
});

describe('TokenService.issueRefreshToken', () => {
  test('issues a refresh token with type=refresh', () => {
    const token = TokenService.issueRefreshToken('user-001');
    const decoded = TokenService.decode(token);
    expect(decoded.sub).toBe('user-001');
    expect(decoded.type).toBe('refresh');
  });
});

describe('TokenService.verify', () => {
  test('verifies a freshly issued access token', () => {
    const token = TokenService.issueAccessToken(mockUser, []);
    const payload = TokenService.verify(token);
    expect(payload.sub).toBe('user-001');
  });

  test('throws on tampered token', () => {
    const token = TokenService.issueAccessToken(mockUser, []);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => TokenService.verify(tampered)).toThrow();
  });

  test('throws on completely invalid string', () => {
    expect(() => TokenService.verify('not.a.token')).toThrow();
  });
});

describe('TokenService.decode', () => {
  test('decodes without verification (no throw on expired)', () => {
    const token = TokenService.issueAccessToken(mockUser, []);
    const decoded = TokenService.decode(token);
    expect(decoded.sub).toBe('user-001');
  });

  test('returns null for garbage input', () => {
    const decoded = TokenService.decode('garbage');
    expect(decoded).toBeNull();
  });
});
