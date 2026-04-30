'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory project store with seeded data.
 * Swappable for a PostgreSQL data-access layer (same interface).
 *
 * Project schema:
 *   id, name, description, status, portfolioId, portfolioName, team, startDate, targetDate,
 *   metadata { repo, jiraBoard, qaEndpoint, ciProvider }
 */

const STATUSES = Object.freeze(['active', 'paused', 'completed', 'at_risk']);

const _seed = () => [
  {
    id: 'proj-001',
    name: 'Payments Gateway v3',
    description: 'Modernize payments gateway to support multi-currency settlement.',
    status: 'active',
    portfolioId: 'pf-fintech',
    portfolioName: 'FinTech Modernization',
    team: 'platform',
    startDate: '2026-01-15',
    targetDate: '2026-06-30',
    metadata: {
      repo: 'org/payments-gateway',
      jiraBoard: 'PGW',
      qaEndpoint: 'https://qa.internal/payments',
      ciProvider: 'github_actions',
    },
  },
  {
    id: 'proj-002',
    name: 'Identity & Access Management 2.0',
    description: 'Centralise IAM across all microservices with OIDC/OAuth2.',
    status: 'active',
    portfolioId: 'pf-security',
    portfolioName: 'Cyber Resilience',
    team: 'security',
    startDate: '2026-02-01',
    targetDate: '2026-07-31',
    metadata: {
      repo: 'org/iam-service',
      jiraBoard: 'IAM',
      qaEndpoint: 'https://qa.internal/iam',
      ciProvider: 'github_actions',
    },
  },
  {
    id: 'proj-003',
    name: 'Data Platform Migration',
    description: 'Migrate legacy data warehouse to lakehouse architecture on cloud.',
    status: 'at_risk',
    portfolioId: 'pf-data',
    portfolioName: 'Data and AI Transformation',
    team: 'data',
    startDate: '2025-11-01',
    targetDate: '2026-05-31',
    metadata: {
      repo: 'org/data-platform',
      jiraBoard: 'DPM',
      qaEndpoint: 'https://qa.internal/data',
      ciProvider: 'gitlab_ci',
    },
  },
  {
    id: 'proj-004',
    name: 'Mobile App Rewrite',
    description: 'Rewrite React Native app with improved UX and offline support.',
    status: 'paused',
    portfolioId: 'pf-experience',
    portfolioName: 'Customer Experience',
    team: 'mobile',
    startDate: '2026-03-01',
    targetDate: '2026-09-30',
    metadata: {
      repo: 'org/mobile-app',
      jiraBoard: 'MOB',
      qaEndpoint: 'https://qa.internal/mobile',
      ciProvider: 'github_actions',
    },
  },
  {
    id: 'proj-005',
    name: 'AI Delivery Risk Intelligence',
    description: 'Real-time multi-agent system for delivery risk detection and prediction.',
    status: 'active',
    portfolioId: 'pf-operations',
    portfolioName: 'Delivery Operations',
    team: 'platform',
    startDate: '2026-04-01',
    targetDate: '2026-12-31',
    metadata: {
      repo: 'org/ai-delivery-risk',
      jiraBoard: 'ADR',
      qaEndpoint: 'https://qa.internal/adri',
      ciProvider: 'github_actions',
    },
  },
];

let _store = new Map(_seed().map(p => [p.id, p]));

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * List all projects, optionally filtered by status.
 * @param {object} filters  { status?: string, team?: string, portfolioId?: string }
 * @returns {Array}
 */
function listAll(filters = {}) {
  let projects = [..._store.values()];
  if (filters.status) {
    projects = projects.filter(p => p.status === filters.status);
  }
  if (filters.team) {
    projects = projects.filter(p => p.team === filters.team);
  }
  if (filters.portfolioId) {
    projects = projects.filter(p => p.portfolioId === filters.portfolioId);
  }
  return projects;
}

/**
 * Find a single project by id.
 * @returns {object|null}
 */
function findById(id) {
  return _store.get(id) || null;
}

/**
 * Create a new project.
 * @param {object} data
 * @returns {object} created project
 */
function create(data) {
  if (!STATUSES.includes(data.status || 'active')) {
    const err = new Error(`Invalid status: ${data.status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const project = {
    id: uuidv4(),
    name: data.name,
    description: data.description || '',
    status: data.status || 'active',
    portfolioId: data.portfolioId || 'pf-unassigned',
    portfolioName: data.portfolioName || 'Unassigned Portfolio',
    team: data.team,
    startDate: data.startDate || new Date().toISOString().slice(0, 10),
    targetDate: data.targetDate || null,
    metadata: data.metadata || {},
  };
  _store.set(project.id, project);
  return project;
}

/**
 * Update project status.
 * @returns {object|null}
 */
function updateStatus(id, status) {
  const project = _store.get(id);
  if (!project) return null;
  if (!STATUSES.includes(status)) {
    const err = new Error(`Invalid status: ${status}`);
    err.code = 'INVALID_STATUS';
    throw err;
  }
  project.status = status;
  return project;
}

/** Reset store to seeded data — for tests only */
function _reset() {
  _store = new Map(_seed().map(p => [p.id, p]));
}

module.exports = { listAll, findById, create, updateStatus, STATUSES, _reset };
