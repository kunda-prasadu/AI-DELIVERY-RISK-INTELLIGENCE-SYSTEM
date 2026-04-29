'use strict';

/**
 * requirePermission(permission) — 403 if the authenticated user's permission list
 * does not include the specified permission.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: `Forbidden — requires permission: ${permission}` });
    }
    return next();
  };
}

/**
 * requireRole(...roles) — 403 if the user's role is not in the allowed list.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden — requires one of roles: ${roles.join(', ')}` });
    }
    return next();
  };
}

module.exports = { requirePermission, requireRole };
