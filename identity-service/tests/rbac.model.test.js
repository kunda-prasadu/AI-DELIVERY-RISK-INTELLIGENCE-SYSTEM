'use strict';

const { ROLES, PERMISSIONS, hasPermission, getPermissionsForRole, isValidRole } = require('../src/models/rbac.model');

/**
 * Unit tests for RBAC model — role definitions, permission checks.
 * US-E-102-03
 */

describe('ROLES constants', () => {
  test('all five roles are defined', () => {
    expect(Object.values(ROLES)).toEqual(expect.arrayContaining([
      'admin', 'director', 'program_manager', 'delivery_manager', 'engineering_lead',
    ]));
  });

  test('roles are frozen (immutable)', () => {
    expect(() => { ROLES.HACKER = 'hacker'; }).toThrow();
  });
});

describe('hasPermission', () => {
  test('admin has all permissions', () => {
    for (const perm of Object.keys(PERMISSIONS)) {
      expect(hasPermission(ROLES.ADMIN, perm)).toBe(true);
    }
  });

  test('director can read projects', () => {
    expect(hasPermission(ROLES.DIRECTOR, 'projects:read')).toBe(true);
  });

  test('director cannot write projects', () => {
    expect(hasPermission(ROLES.DIRECTOR, 'projects:write')).toBe(false);
  });

  test('engineering_lead can read risk', () => {
    expect(hasPermission(ROLES.ENGINEERING_LEAD, 'risk:read')).toBe(true);
  });

  test('engineering_lead cannot delete projects', () => {
    expect(hasPermission(ROLES.ENGINEERING_LEAD, 'projects:delete')).toBe(false);
  });

  test('delivery_manager can assign recommendations', () => {
    expect(hasPermission(ROLES.DELIVERY_MANAGER, 'recommendations:assign')).toBe(true);
  });

  test('delivery_manager cannot access users:read', () => {
    expect(hasPermission(ROLES.DELIVERY_MANAGER, 'users:read')).toBe(false);
  });

  test('program_manager can read portfolio', () => {
    expect(hasPermission(ROLES.PROGRAM_MANAGER, 'portfolio:read')).toBe(true);
  });

  test('engineering_lead cannot read portfolio', () => {
    expect(hasPermission(ROLES.ENGINEERING_LEAD, 'portfolio:read')).toBe(false);
  });

  test('returns false for unknown permission', () => {
    expect(hasPermission(ROLES.ADMIN, 'nonexistent:action')).toBe(false);
  });

  test('returns false for unknown role', () => {
    expect(hasPermission('hacker', 'projects:read')).toBe(false);
  });
});

describe('getPermissionsForRole', () => {
  test('admin permissions are non-empty', () => {
    const perms = getPermissionsForRole(ROLES.ADMIN);
    expect(perms.length).toBeGreaterThan(0);
  });

  test('director permissions do not include users:write', () => {
    const perms = getPermissionsForRole(ROLES.DIRECTOR);
    expect(perms).not.toContain('users:write');
  });

  test('unknown role returns empty array', () => {
    expect(getPermissionsForRole('ghost')).toEqual([]);
  });
});

describe('isValidRole', () => {
  test('returns true for known roles', () => {
    for (const r of Object.values(ROLES)) {
      expect(isValidRole(r)).toBe(true);
    }
  });

  test('returns false for unknown role string', () => {
    expect(isValidRole('super_hacker')).toBe(false);
  });
});
