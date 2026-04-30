'use strict';

const AuditStore = require('../models/audit.store');
const { hasPermission } = require('../models/rbac.model');
const logger = require('./logger');

/**
 * requirePermission(permission) — Express middleware factory.
 *
 * Usage:
 *   router.get('/projects', authenticateJWT, requirePermission('projects:read'), handler)
 *
 * Must be used AFTER authenticateJWT so req.user is populated.
 * Returns 403 Forbidden if the authenticated user's role does not hold the required permission.
 *
 * PRD reference: BE-05 — Unauthorized role cannot access restricted project data
 */
function requirePermission(permission) {
  return function rbacMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { role, id } = req.user;

    if (!hasPermission(role, permission)) {
      logger.warn('[RBAC] Access denied', {
        userId: id,
        role,
        requiredPermission: permission,
        path: req.path,
        method: req.method,
      });
      AuditStore.record({
        actorId: id,
        actorRole: role,
        action: 'rbac.permission.denied',
        resourceType: 'permission',
        resourceId: permission,
        outcome: 'FAILURE',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
        metadata: { path: req.path, method: req.method },
      });
      return res.status(403).json({
        error: 'Forbidden',
        detail: `Role '${role}' does not have permission '${permission}'`,
      });
    }

    next();
  };
}

/**
 * requireRole(...roles) — alternative middleware for simple role-based guards.
 *
 * Usage:
 *   router.delete('/users/:id', authenticateJWT, requireRole('admin'), handler)
 */
function requireRole(...allowedRoles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('[RBAC] Role not allowed', {
        userId: req.user.id,
        role: req.user.role,
        allowedRoles,
        path: req.path,
      });
      AuditStore.record({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'rbac.role.denied',
        resourceType: 'role',
        resourceId: allowedRoles.join(','),
        outcome: 'FAILURE',
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || null,
        metadata: { path: req.path },
      });
      return res.status(403).json({
        error: 'Forbidden',
        detail: `Role '${req.user.role}' is not permitted for this operation`,
      });
    }

    next();
  };
}

module.exports = { requirePermission, requireRole };
