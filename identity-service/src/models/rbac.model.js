'use strict';

/**
 * RBAC role definitions and permission registry.
 *
 * Roles map directly to the personas defined in PRD Section 2:
 *   - delivery_manager  → track project risk, assign actions, close risk loop
 *   - program_manager   → portfolio heatmap, cross-project escalations
 *   - engineering_lead  → module-level risks, team overload
 *   - director          → executive KPIs, forecast delivery outcomes
 *   - admin             → system administration, user management
 *
 * PRD reference: BE-05 — Unauthorized role cannot access restricted project data
 */

const ROLES = Object.freeze({
  ADMIN:            'admin',
  DIRECTOR:         'director',
  PROGRAM_MANAGER:  'program_manager',
  DELIVERY_MANAGER: 'delivery_manager',
  ENGINEERING_LEAD: 'engineering_lead',
});

/**
 * Permission registry — each permission maps to an array of roles that hold it.
 *
 * Naming convention: resource:action
 */
const PERMISSIONS = Object.freeze({
  // Projects
  'projects:read':            [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PROGRAM_MANAGER, ROLES.DELIVERY_MANAGER, ROLES.ENGINEERING_LEAD],
  'projects:write':           [ROLES.ADMIN, ROLES.DELIVERY_MANAGER],
  'projects:delete':          [ROLES.ADMIN],

  // Risk scores & insights
  'risk:read':                [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PROGRAM_MANAGER, ROLES.DELIVERY_MANAGER, ROLES.ENGINEERING_LEAD],
  'risk:write':               [ROLES.ADMIN],

  // Recommendations
  'recommendations:read':     [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PROGRAM_MANAGER, ROLES.DELIVERY_MANAGER, ROLES.ENGINEERING_LEAD],
  'recommendations:assign':   [ROLES.ADMIN, ROLES.DELIVERY_MANAGER],
  'recommendations:feedback': [ROLES.ADMIN, ROLES.DELIVERY_MANAGER, ROLES.ENGINEERING_LEAD],

  // Reports
  'reports:read':             [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PROGRAM_MANAGER, ROLES.DELIVERY_MANAGER],
  'reports:generate':         [ROLES.ADMIN, ROLES.DELIVERY_MANAGER],

  // Alerts
  'alerts:read':              [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PROGRAM_MANAGER, ROLES.DELIVERY_MANAGER, ROLES.ENGINEERING_LEAD],
  'alerts:acknowledge':       [ROLES.ADMIN, ROLES.DELIVERY_MANAGER, ROLES.ENGINEERING_LEAD],

  // Portfolio (program manager + above)
  'portfolio:read':           [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.PROGRAM_MANAGER],

  // Admin
  'users:read':               [ROLES.ADMIN],
  'users:write':              [ROLES.ADMIN],
  'connectors:manage':        [ROLES.ADMIN],
  'audit:read':               [ROLES.ADMIN],
});

/**
 * Check if a given role has a specific permission.
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
function hasPermission(role, permission) {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Return all permissions granted to a role.
 * @param {string} role
 * @returns {string[]}
 */
function getPermissionsForRole(role) {
  return Object.entries(PERMISSIONS)
    .filter(([, roles]) => roles.includes(role))
    .map(([perm]) => perm);
}

/**
 * Validate that a role string is a known role.
 * @param {string} role
 * @returns {boolean}
 */
function isValidRole(role) {
  return Object.values(ROLES).includes(role);
}

module.exports = { ROLES, PERMISSIONS, hasPermission, getPermissionsForRole, isValidRole };
