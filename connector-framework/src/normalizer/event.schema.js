'use strict';

const Joi = require('joi');

/**
 * NormalizedEvent — the canonical event schema that all connectors must produce.
 *
 * Every field documented here is what downstream agents (Risk Detection,
 * Prediction, Reporting) expect to receive.  The schema is versioned (v1)
 * to support Schema Registry backward-compatibility checks (PRD MW).
 */

/**
 * @typedef {object} NormalizedEvent
 * @property {string}  id            - source-system unique identifier (e.g. Jira issue key)
 * @property {string}  source        - 'jira' | 'github' | 'qa' | 'cicd'
 * @property {string}  eventType     - fine-grained type ('issue' | 'commit' | 'pull_request' | 'test_run' | 'pipeline_run')
 * @property {string}  project       - project / repo name
 * @property {string}  title         - short human-readable label
 * @property {string}  status        - normalized status string (open | in_progress | done | failed | passed | etc.)
 * @property {string}  severity      - 'low' | 'medium' | 'high' | 'critical' | 'unknown'
 * @property {string}  assignee      - assignee account name or email (nullable)
 * @property {string}  author        - creator / author account name or email
 * @property {string}  createdAt     - ISO 8601 timestamp
 * @property {string}  updatedAt     - ISO 8601 timestamp
 * @property {number|null} dueDate   - Unix ms epoch or null
 * @property {object}  metrics       - source-specific numeric signals (story points, duration, pass rate, etc.)
 * @property {string[]} labels       - array of tags / labels
 * @property {string}  rawId         - original raw ID from source
 * @property {string}  schemaVersion - event schema version (currently 'v1')
 * @property {string}  runId         - ingestion cycle UUID (set by BaseConnector)
 * @property {string}  ingestedAt    - ISO 8601 timestamp when this event was produced
 */

/**
 * Joi schema for validating NormalizedEvents before publishing downstream.
 * Used by SchemaValidator middleware (MW-02).
 */
const normalizedEventSchema = Joi.object({
  id: Joi.string().required(),
  source: Joi.string().valid('jira', 'github', 'qa', 'cicd').required(),
  eventType: Joi.string().required(),
  project: Joi.string().required(),
  title: Joi.string().required(),
  status: Joi.string().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical', 'unknown').default('unknown'),
  assignee: Joi.string().allow(null, '').default(null),
  author: Joi.string().allow(null, '').default(null),
  createdAt: Joi.string().isoDate().required(),
  updatedAt: Joi.string().isoDate().required(),
  dueDate: Joi.number().allow(null).default(null),
  metrics: Joi.object().default({}),
  labels: Joi.array().items(Joi.string()).default([]),
  rawId: Joi.string().required(),
  schemaVersion: Joi.string().default('v1'),
  runId: Joi.string().allow(null, '').default(null),
  ingestedAt: Joi.string().isoDate().default(() => new Date().toISOString()),
});

module.exports = { normalizedEventSchema };
