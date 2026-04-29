'use strict';

/**
 * In-memory event store for NormalizedEvents ingested from E-101 connector-framework.
 *
 * In production this is backed by a message queue consumer (Kafka/Redis Streams).
 * For the seed layer we maintain a bounded ring buffer per project (latest 200 events).
 *
 * NormalizedEvent contract (E-101 v1 schema):
 *   id, source, eventType, projectId, timestamp, severity,
 *   metadata { commitSha?, prNumber?, branch?, testSuite?, buildId? }
 */

const MAX_EVENTS_PER_PROJECT = 200;

let _events = new Map(); // projectId → Array<NormalizedEvent>

// ── Seed events to back-fill risk signals for each seeded project ──────────

const _seedEvents = () => {
  const now = Date.now();
  const hour = 3_600_000;
  const templates = [
    // proj-001 — mostly healthy
    { projectId: 'proj-001', source: 'github', eventType: 'commit', severity: 'info', count: 20, recentWindow: 24 * hour },
    { projectId: 'proj-001', source: 'github', eventType: 'pr_merged', severity: 'info', count: 5, recentWindow: 48 * hour },
    { projectId: 'proj-001', source: 'qa', eventType: 'test_run', severity: 'info', count: 8, recentWindow: 24 * hour },
    { projectId: 'proj-001', source: 'cicd', eventType: 'build_success', severity: 'info', count: 10, recentWindow: 24 * hour },
    { projectId: 'proj-001', source: 'cicd', eventType: 'build_failure', severity: 'warning', count: 1, recentWindow: 24 * hour },
    { projectId: 'proj-001', source: 'jira', eventType: 'issue_closed', severity: 'info', count: 15, recentWindow: 168 * hour },
    // proj-003 — at-risk project
    { projectId: 'proj-003', source: 'github', eventType: 'commit', severity: 'info', count: 2, recentWindow: 24 * hour },
    { projectId: 'proj-003', source: 'github', eventType: 'pr_merged', severity: 'info', count: 0, recentWindow: 48 * hour },
    { projectId: 'proj-003', source: 'qa', eventType: 'test_run', severity: 'critical', count: 6, recentWindow: 24 * hour },
    { projectId: 'proj-003', source: 'cicd', eventType: 'build_failure', severity: 'critical', count: 8, recentWindow: 24 * hour },
    { projectId: 'proj-003', source: 'cicd', eventType: 'build_success', severity: 'info', count: 2, recentWindow: 24 * hour },
    { projectId: 'proj-003', source: 'jira', eventType: 'issue_closed', severity: 'info', count: 3, recentWindow: 168 * hour },
    // proj-002 — moderate
    { projectId: 'proj-002', source: 'github', eventType: 'commit', severity: 'info', count: 12, recentWindow: 24 * hour },
    { projectId: 'proj-002', source: 'cicd', eventType: 'build_success', severity: 'info', count: 7, recentWindow: 24 * hour },
    { projectId: 'proj-002', source: 'cicd', eventType: 'build_failure', severity: 'warning', count: 3, recentWindow: 24 * hour },
    { projectId: 'proj-002', source: 'qa', eventType: 'test_run', severity: 'warning', count: 4, recentWindow: 24 * hour },
    { projectId: 'proj-002', source: 'jira', eventType: 'issue_closed', severity: 'info', count: 8, recentWindow: 168 * hour },
    // proj-004 — paused, sparse events
    { projectId: 'proj-004', source: 'github', eventType: 'commit', severity: 'info', count: 1, recentWindow: 168 * hour },
    // proj-005 — healthy
    { projectId: 'proj-005', source: 'github', eventType: 'commit', severity: 'info', count: 18, recentWindow: 24 * hour },
    { projectId: 'proj-005', source: 'github', eventType: 'pr_merged', severity: 'info', count: 6, recentWindow: 48 * hour },
    { projectId: 'proj-005', source: 'qa', eventType: 'test_run', severity: 'info', count: 10, recentWindow: 24 * hour },
    { projectId: 'proj-005', source: 'cicd', eventType: 'build_success', severity: 'info', count: 12, recentWindow: 24 * hour },
    { projectId: 'proj-005', source: 'jira', eventType: 'issue_closed', severity: 'info', count: 20, recentWindow: 168 * hour },
  ];

  for (const t of templates) {
    const arr = _events.get(t.projectId) || [];
    for (let i = 0; i < t.count; i++) {
      arr.push({
        id: `seed-${t.projectId}-${t.source}-${i}`,
        source: t.source,
        eventType: t.eventType,
        projectId: t.projectId,
        timestamp: new Date(now - Math.random() * t.recentWindow).toISOString(),
        severity: t.severity,
        metadata: {},
      });
    }
    _events.set(t.projectId, arr);
  }
};

_seedEvents();

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Push a new NormalizedEvent for a project (ring buffer — drops oldest beyond MAX).
 */
function push(event) {
  const arr = _events.get(event.projectId) || [];
  arr.push(event);
  if (arr.length > MAX_EVENTS_PER_PROJECT) arr.splice(0, arr.length - MAX_EVENTS_PER_PROJECT);
  _events.set(event.projectId, arr);
}

/**
 * Get all events for a project.
 * @returns {Array<NormalizedEvent>}
 */
function getForProject(projectId) {
  return [...(_events.get(projectId) || [])];
}

/**
 * Get events filtered by source and/or eventType.
 */
function query(projectId, { source, eventType, since } = {}) {
  let events = _events.get(projectId) || [];
  if (source)    events = events.filter(e => e.source === source);
  if (eventType) events = events.filter(e => e.eventType === eventType);
  if (since)     events = events.filter(e => new Date(e.timestamp) >= new Date(since));
  return [...events];
}

/** Reset for tests */
function _reset() {
  _events = new Map();
  _seedEvents();
}

module.exports = { push, getForProject, query, _reset };
