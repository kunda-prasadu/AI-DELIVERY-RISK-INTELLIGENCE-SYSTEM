'use strict';

const UserStore = require('../src/models/user.store');
const { ROLES } = require('../src/models/rbac.model');

/**
 * Unit tests for UserStore — create, lookup, password verify, refresh tokens, deactivate.
 * US-E-102-03
 */

beforeEach(() => UserStore._reset());

const validUser = {
  email: 'alice@example.com',
  password: 'Password@123',
  name: 'Alice Smith',
  role: ROLES.DELIVERY_MANAGER,
};

describe('UserStore.create', () => {
  test('creates user and returns sanitized record (no passwordHash)', async () => {
    const user = await UserStore.create(validUser);
    expect(user.id).toBeTruthy();
    expect(user.email).toBe('alice@example.com');
    expect(user.role).toBe(ROLES.DELIVERY_MANAGER);
    expect(user.active).toBe(true);
    expect(user.passwordHash).toBeUndefined();
  });

  test('email is stored lowercase', async () => {
    const user = await UserStore.create({ ...validUser, email: 'ALICE@EXAMPLE.COM' });
    expect(user.email).toBe('alice@example.com');
  });

  test('throws DUPLICATE_EMAIL on duplicate registration', async () => {
    await UserStore.create(validUser);
    await expect(UserStore.create(validUser)).rejects.toMatchObject({ code: 'DUPLICATE_EMAIL' });
  });

  test('throws INVALID_ROLE for unknown role', async () => {
    await expect(UserStore.create({ ...validUser, role: 'superuser' }))
      .rejects.toMatchObject({ code: 'INVALID_ROLE' });
  });
});

describe('UserStore.findByEmail', () => {
  test('finds user after creation', async () => {
    await UserStore.create(validUser);
    const found = await UserStore.findByEmail('alice@example.com');
    expect(found).not.toBeNull();
    expect(found.passwordHash).toBeTruthy(); // raw record for auth
  });

  test('returns null for unknown email', async () => {
    const found = await UserStore.findByEmail('nobody@example.com');
    expect(found).toBeNull();
  });
});

describe('UserStore.findById', () => {
  test('finds user by id', async () => {
    const created = await UserStore.create(validUser);
    const found = await UserStore.findById(created.id);
    expect(found.id).toBe(created.id);
  });

  test('returns null for unknown id', async () => {
    expect(await UserStore.findById('nonexistent-uuid')).toBeNull();
  });
});

describe('UserStore.verifyPassword', () => {
  test('returns true for correct password', async () => {
    const created = await UserStore.create(validUser);
    const record = await UserStore.findByEmail(created.email);
    const result = await UserStore.verifyPassword('Password@123', record.passwordHash);
    expect(result).toBe(true);
  });

  test('returns false for wrong password', async () => {
    const created = await UserStore.create(validUser);
    const record = await UserStore.findByEmail(created.email);
    const result = await UserStore.verifyPassword('WrongPassword!', record.passwordHash);
    expect(result).toBe(false);
  });
});

describe('UserStore refresh tokens', () => {
  test('store and retrieve refresh token', async () => {
    UserStore.storeRefreshToken('tok-123', 'user-abc');
    expect(UserStore.getUserIdByRefreshToken('tok-123')).toBe('user-abc');
  });

  test('revoke removes token', () => {
    UserStore.storeRefreshToken('tok-456', 'user-def');
    UserStore.revokeRefreshToken('tok-456');
    expect(UserStore.getUserIdByRefreshToken('tok-456')).toBeNull();
  });

  test('revokeAll removes all tokens for a user', () => {
    UserStore.storeRefreshToken('tok-a', 'user-xyz');
    UserStore.storeRefreshToken('tok-b', 'user-xyz');
    UserStore.storeRefreshToken('tok-c', 'user-other');
    UserStore.revokeAllRefreshTokensForUser('user-xyz');
    expect(UserStore.getUserIdByRefreshToken('tok-a')).toBeNull();
    expect(UserStore.getUserIdByRefreshToken('tok-b')).toBeNull();
    expect(UserStore.getUserIdByRefreshToken('tok-c')).toBe('user-other');
  });
});

describe('UserStore.deactivate', () => {
  test('sets active=false', async () => {
    const user = await UserStore.create(validUser);
    UserStore.deactivate(user.id);
    const found = await UserStore.findById(user.id);
    expect(found.active).toBe(false);
  });

  test('returns false for unknown id', () => {
    expect(UserStore.deactivate('no-such-id')).toBe(false);
  });
});
