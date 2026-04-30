'use strict';

/**
 * In-memory user store for the identity service.
 *
 * In production this is backed by PostgreSQL (users table in the data model).
 * For E-102 (baseline), we provide an in-process store with the same interface
 * so all service logic, middleware, and tests work identically.
 * Swap store.js for a Postgres-backed implementation in E-201 without changing
 * any dependent code.
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const config = require('../config/identity.config');
const { isValidRole, ROLES } = require('./rbac.model');

/** @type {Map<string, User>}  keyed by userId */
const _usersById = new Map();

/** @type {Map<string, string>}  email → userId index */
const _emailIndex = new Map();

/** @type {Map<string, string>}  refreshToken → userId */
const _refreshTokens = new Map();

/**
 * @typedef {object} User
 * @property {string}  id
 * @property {string}  email
 * @property {string}  passwordHash
 * @property {string}  name
 * @property {string}  role
 * @property {boolean} active
 * @property {string}  createdAt
 * @property {string}  updatedAt
 */

const UserStore = {
  /**
   * Create a new user. Throws if email already exists.
   * @param {{ email, password, name, role }} input
   * @returns {Promise<User>}
   */
  async create({ email, password, name, role }) {
    if (_emailIndex.has(email.toLowerCase())) {
      throw Object.assign(new Error('Email already registered'), { code: 'DUPLICATE_EMAIL' });
    }
    if (!isValidRole(role)) {
      throw Object.assign(new Error(`Invalid role: ${role}`), { code: 'INVALID_ROLE' });
    }

    const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
    const now = new Date().toISOString();
    const user = {
      id: uuidv4(),
      email: email.toLowerCase(),
      passwordHash,
      name,
      role,
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    _usersById.set(user.id, user);
    _emailIndex.set(user.email, user.id);
    return _sanitize(user);
  },

  /**
   * Find user by email. Returns null if not found.
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    const id = _emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return _usersById.get(id) || null;
  },

  /**
   * Find user by ID. Returns null if not found.
   * @param {string} id
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    return _usersById.get(id) || null;
  },

  /**
   * Verify a plain-text password against stored hash.
   * @param {string} plainPassword
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async verifyPassword(plainPassword, hash) {
    return bcrypt.compare(plainPassword, hash);
  },

  /**
   * List all users (admin only).
   * @returns {User[]}
   */
  listAll() {
    return Array.from(_usersById.values()).map(_sanitize);
  },

  /**
   * Deactivate a user account.
   * @param {string} id
   * @returns {boolean}
   */
  deactivate(id) {
    const user = _usersById.get(id);
    if (!user) return false;
    user.active = false;
    user.updatedAt = new Date().toISOString();
    return true;
  },

  // ── Refresh token management ────────────────────────────────────────────────

  storeRefreshToken(token, userId) {
    _refreshTokens.set(token, userId);
  },

  getUserIdByRefreshToken(token) {
    return _refreshTokens.get(token) || null;
  },

  revokeRefreshToken(token) {
    return _refreshTokens.delete(token);
  },

  revokeAllRefreshTokensForUser(userId) {
    for (const [token, uid] of _refreshTokens.entries()) {
      if (uid === userId) _refreshTokens.delete(token);
    }
  },

  /** Seed an admin user for bootstrap (only if none exists). */
  async _seedAdmin() {
    if (_usersById.size === 0) {
      await UserStore.create({
        email: 'admin@ai-delivery-risk.io',
        password: 'Admin@12345!',
        name: 'System Admin',
        role: ROLES.ADMIN,
      });
    }
  },

  /** For tests only — reset all state. */
  _reset() {
    _usersById.clear();
    _emailIndex.clear();
    _refreshTokens.clear();
  },
};

/** Strip sensitive fields from user object. */
function _sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = UserStore;
