'use strict';

const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const UserStore = require('../models/user.store');
const TokenService = require('../models/token.service');
const { getPermissionsForRole, isValidRole, ROLES } = require('../models/rbac.model');
const { authenticateJWT } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const config = require('../config/identity.config');
const logger = require('../middleware/logger');

const router = express.Router();

// ── Auth-specific rate limiter (stricter than global) ─────────────────────
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts — please try again later' },
});

// ── Validation schemas ─────────────────────────────────────────────────────

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    }),
  name: Joi.string().min(2).max(80).required(),
  role: Joi.string().valid(...Object.values(ROLES)).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ── POST /auth/register ────────────────────────────────────────────────────
/**
 * Register a new user (admin-only in production; open for bootstrap).
 * Returns: { user, accessToken, refreshToken }
 */
router.post('/register', authLimiter, async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
  }

  try {
    const user = await UserStore.create(value);
    const permissions = getPermissionsForRole(user.role);
    const accessToken  = TokenService.issueAccessToken(user, permissions);
    const refreshToken = TokenService.issueRefreshToken(user.id);
    UserStore.storeRefreshToken(refreshToken, user.id);

    logger.info('[Auth] User registered', { userId: user.id, role: user.role });

    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    logger.error('[Auth] Registration failed', { error: err.message });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /auth/login ───────────────────────────────────────────────────────
/**
 * Authenticate with email + password.
 * Returns: { user, accessToken, refreshToken }
 */
router.post('/login', authLimiter, async (req, res) => {
  const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
  }

  try {
    const userRecord = await UserStore.findByEmail(value.email);

    // Use constant-time comparison to prevent timing attacks
    const valid = userRecord
      ? await UserStore.verifyPassword(value.password, userRecord.passwordHash)
      : await UserStore.verifyPassword(value.password, '$2a$12$invalidhashpadding00000000000000000000000000000000000'); // dummy

    if (!userRecord || !valid || !userRecord.active) {
      logger.warn('[Auth] Login failed', { email: value.email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const permissions = getPermissionsForRole(userRecord.role);
    const accessToken  = TokenService.issueAccessToken(userRecord, permissions);
    const refreshToken = TokenService.issueRefreshToken(userRecord.id);
    UserStore.storeRefreshToken(refreshToken, userRecord.id);

    const { passwordHash: _, ...safeUser } = userRecord;

    logger.info('[Auth] Login successful', { userId: userRecord.id, role: userRecord.role });

    return res.status(200).json({ user: safeUser, accessToken, refreshToken });
  } catch (err) {
    logger.error('[Auth] Login error', { error: err.message });
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────
/**
 * Exchange a valid refresh token for a new access token.
 * Returns: { accessToken }
 */
router.post('/refresh', async (req, res) => {
  const { error, value } = refreshSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const payload = TokenService.verify(value.refreshToken);

    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const storedUserId = UserStore.getUserIdByRefreshToken(value.refreshToken);
    if (!storedUserId || storedUserId !== payload.sub) {
      return res.status(401).json({ error: 'Refresh token revoked or invalid' });
    }

    const user = await UserStore.findById(payload.sub);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const permissions = getPermissionsForRole(user.role);
    const accessToken = TokenService.issueAccessToken(user, permissions);

    return res.status(200).json({ accessToken });
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Refresh token expired' : 'Invalid refresh token';
    return res.status(401).json({ error: message });
  }
});

// ── POST /auth/logout ──────────────────────────────────────────────────────
/**
 * Revoke the refresh token.
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    UserStore.revokeRefreshToken(refreshToken);
  } else {
    UserStore.revokeAllRefreshTokensForUser(req.user.id);
  }
  logger.info('[Auth] Logout', { userId: req.user.id });
  return res.status(200).json({ message: 'Logged out successfully' });
});

// ── GET /auth/me ───────────────────────────────────────────────────────────
/**
 * Return the authenticated user's profile and permissions.
 */
router.get('/me', authenticateJWT, (req, res) => {
  const permissions = getPermissionsForRole(req.user.role);
  return res.status(200).json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
    },
    permissions,
  });
});

// ── GET /auth/users ────────────────────────────────────────────────────────
/**
 * List all users — admin only.
 */
router.get('/users', authenticateJWT, requireRole(ROLES.ADMIN), (req, res) => {
  return res.status(200).json({ users: UserStore.listAll() });
});

// ── DELETE /auth/users/:id ─────────────────────────────────────────────────
/**
 * Deactivate a user — admin only.
 */
router.delete('/users/:id', authenticateJWT, requireRole(ROLES.ADMIN), (req, res) => {
  const deactivated = UserStore.deactivate(req.params.id);
  if (!deactivated) {
    return res.status(404).json({ error: 'User not found' });
  }
  UserStore.revokeAllRefreshTokensForUser(req.params.id);
  logger.info('[Auth] User deactivated', { targetUserId: req.params.id, by: req.user.id });
  return res.status(200).json({ message: 'User deactivated' });
});

module.exports = router;
