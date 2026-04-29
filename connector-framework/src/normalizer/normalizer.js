'use strict';

/**
 * Normalizer — transforms raw API payloads from each source into NormalizedEvents.
 *
 * One exported function per source:
 *   - normalizeJiraIssue(raw)
 *   - normalizeGitHubEvent(raw)
 *   - normalizeQAEvent(raw, tool)
 *   - normalizeCICDEvent(raw, provider)
 *
 * PRD references: API Adapter Layer (MW), FR-01
 */

const NOW = () => new Date().toISOString();

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeDate(value) {
  if (!value) return NOW();
  const d = new Date(value);
  return isNaN(d.getTime()) ? NOW() : d.toISOString();
}

function safeDueDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Map Jira priority name to internal severity.
 * @param {string} priorityName
 */
function jiraPriorityToSeverity(priorityName) {
  const map = {
    blocker: 'critical',
    critical: 'critical',
    highest: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    lowest: 'low',
    trivial: 'low',
  };
  return map[(priorityName || '').toLowerCase()] || 'unknown';
}

/**
 * Map Jira status category to internal status.
 */
function jiraStatusToNorm(status) {
  const cat = (status?.statusCategory?.key || status?.name || '').toLowerCase();
  if (cat === 'indeterminate' || cat === 'in progress') return 'in_progress';
  if (cat === 'done') return 'done';
  if (cat === 'new' || cat === 'to do') return 'open';
  return (status?.name || 'unknown').toLowerCase().replace(/\s+/g, '_');
}

// ── Jira ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} issue - raw Jira REST v3 issue object
 * @returns {NormalizedEvent}
 */
function normalizeJiraIssue(issue) {
  const f = issue.fields || {};
  const storyPoints =
    f.customfield_10028 ??    // next-gen
    f.customfield_10016 ??    // classic
    null;

  return {
    id: issue.key,
    rawId: issue.id,
    source: 'jira',
    eventType: 'issue',
    project: f.project?.key || f.project?.name || issue.key?.split('-')[0] || 'UNKNOWN',
    title: f.summary || '(no summary)',
    status: jiraStatusToNorm(f.status),
    severity: jiraPriorityToSeverity(f.priority?.name),
    assignee: f.assignee?.emailAddress || f.assignee?.displayName || null,
    author: f.reporter?.emailAddress || f.reporter?.displayName || null,
    createdAt: safeDate(f.created),
    updatedAt: safeDate(f.updated),
    dueDate: safeDueDate(f.duedate),
    metrics: {
      storyPoints,
      commentCount: f.comment?.total ?? 0,
    },
    labels: f.labels || [],
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

// ── GitHub ────────────────────────────────────────────────────────────────────

/**
 * @param {object} raw - raw GitHub object with _kind: 'commit' | 'pull_request' | 'workflow_run'
 * @returns {NormalizedEvent}
 */
function normalizeGitHubEvent(raw) {
  switch (raw._kind) {
    case 'commit':
      return _normalizeCommit(raw);
    case 'pull_request':
      return _normalizePR(raw);
    case 'workflow_run':
      return _normalizeWorkflowRun(raw);
    default:
      throw new Error(`GitHubNormalizer: unknown _kind "${raw._kind}"`);
  }
}

function _normalizeCommit(c) {
  return {
    id: c.sha,
    rawId: c.sha,
    source: 'github',
    eventType: 'commit',
    project: c._repo || 'unknown',
    title: (c.commit?.message || '').split('\n')[0].slice(0, 120),
    status: 'committed',
    severity: 'unknown',
    assignee: null,
    author: c.commit?.author?.email || c.author?.login || null,
    createdAt: safeDate(c.commit?.author?.date),
    updatedAt: safeDate(c.commit?.committer?.date || c.commit?.author?.date),
    dueDate: null,
    metrics: {
      additions: c.stats?.additions ?? null,
      deletions: c.stats?.deletions ?? null,
    },
    labels: [],
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

function _normalizePR(pr) {
  const stateMap = { open: 'open', closed: pr.merged_at ? 'done' : 'closed' };
  return {
    id: String(pr.number),
    rawId: String(pr.id),
    source: 'github',
    eventType: 'pull_request',
    project: pr._repo || pr.base?.repo?.full_name || 'unknown',
    title: pr.title || '(no title)',
    status: stateMap[pr.state] || pr.state || 'unknown',
    severity: pr.draft ? 'low' : 'unknown',
    assignee: pr.assignee?.login || null,
    author: pr.user?.login || null,
    createdAt: safeDate(pr.created_at),
    updatedAt: safeDate(pr.updated_at),
    dueDate: null,
    metrics: {
      additions: pr.additions ?? null,
      deletions: pr.deletions ?? null,
      changedFiles: pr.changed_files ?? null,
      reviewCount: pr.requested_reviewers?.length ?? 0,
    },
    labels: (pr.labels || []).map(l => l.name),
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

function _normalizeWorkflowRun(run) {
  const conclusionMap = {
    success: 'passed',
    failure: 'failed',
    cancelled: 'cancelled',
    skipped: 'skipped',
    timed_out: 'failed',
  };
  const severityMap = { failure: 'high', timed_out: 'medium' };

  return {
    id: String(run.id),
    rawId: String(run.id),
    source: 'github',
    eventType: 'workflow_run',
    project: run._repo || run.repository?.full_name || 'unknown',
    title: `${run.name || 'workflow'} #${run.run_number}`,
    status: conclusionMap[run.conclusion] || run.status || 'unknown',
    severity: severityMap[run.conclusion] || 'unknown',
    assignee: null,
    author: run.triggering_actor?.login || run.actor?.login || null,
    createdAt: safeDate(run.created_at),
    updatedAt: safeDate(run.updated_at),
    dueDate: null,
    metrics: {
      durationMs: run.run_started_at && run.updated_at
        ? new Date(run.updated_at) - new Date(run.run_started_at)
        : null,
      runAttempt: run.run_attempt ?? 1,
    },
    labels: [],
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

// ── QA ────────────────────────────────────────────────────────────────────────

/**
 * @param {object} run - raw test-run object
 * @param {string} tool - 'testng' | 'jest' | 'allure' | 'custom'
 * @returns {NormalizedEvent}
 */
function normalizeQAEvent(run, tool = 'custom') {
  // Try common field names across reporting tools
  const total = run.total ?? run.totalTests ?? run.tests ?? 0;
  const passed = run.passed ?? run.passCount ?? run.pass ?? 0;
  const failed = run.failed ?? run.failCount ?? run.fail ?? 0;
  const skipped = run.skipped ?? run.skipCount ?? run.skip ?? 0;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : null;

  const statusByRate = passRate === null
    ? 'unknown'
    : passRate === 100
      ? 'passed'
      : passRate >= 80
        ? 'partial'
        : 'failed';

  const severity = failed > 0
    ? (failed / (total || 1) >= 0.2 ? 'high' : 'medium')
    : 'low';

  return {
    id: run.id || run.runId || run.executionId || String(Date.now()),
    rawId: run.id || String(Date.now()),
    source: 'qa',
    eventType: 'test_run',
    project: run.project || run.suite || run.suiteName || 'unknown',
    title: run.name || run.suiteName || `Test Run — ${tool}`,
    status: statusByRate,
    severity,
    assignee: run.triggeredBy || run.executor || null,
    author: run.triggeredBy || run.executor || null,
    createdAt: safeDate(run.startedAt || run.executedAt || run.createdAt),
    updatedAt: safeDate(run.finishedAt || run.updatedAt || run.executedAt),
    dueDate: null,
    metrics: { total, passed, failed, skipped, passRate },
    labels: [tool],
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

// ── CI/CD ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} raw - raw pipeline/build object
 * @param {string} provider - 'github_actions' | 'jenkins' | 'gitlab'
 * @returns {NormalizedEvent}
 */
function normalizeCICDEvent(raw, provider) {
  switch (provider) {
    case 'github_actions':
      return _normalizeWorkflowRun({ ...raw, _repo: raw._repo });
    case 'jenkins':
      return _normalizeJenkinsBuild(raw);
    case 'gitlab':
      return _normalizeGitLabPipeline(raw);
    default:
      throw new Error(`CICDNormalizer: unknown provider "${provider}"`);
  }
}

function _normalizeJenkinsBuild(build) {
  const resultMap = {
    SUCCESS: 'passed',
    FAILURE: 'failed',
    UNSTABLE: 'partial',
    ABORTED: 'cancelled',
    NOT_BUILT: 'skipped',
  };
  const severityMap = { FAILURE: 'high', UNSTABLE: 'medium' };

  return {
    id: `${build._jobName}#${build.number}`,
    rawId: String(build.number),
    source: 'cicd',
    eventType: 'pipeline_run',
    project: build._jobName || 'unknown',
    title: `${build._jobName} #${build.number}`,
    status: resultMap[build.result] || 'unknown',
    severity: severityMap[build.result] || 'unknown',
    assignee: null,
    author: null,
    createdAt: safeDate(build.timestamp ? new Date(build.timestamp) : null),
    updatedAt: safeDate(build.timestamp ? new Date(build.timestamp + build.duration) : null),
    dueDate: null,
    metrics: { durationMs: build.duration ?? null },
    labels: ['jenkins'],
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

function _normalizeGitLabPipeline(pipeline) {
  const statusMap = {
    success: 'passed',
    failed: 'failed',
    canceled: 'cancelled',
    skipped: 'skipped',
    pending: 'open',
    running: 'in_progress',
  };
  const severity = pipeline.status === 'failed' ? 'high' : 'unknown';

  return {
    id: String(pipeline.id),
    rawId: String(pipeline.id),
    source: 'cicd',
    eventType: 'pipeline_run',
    project: pipeline._projectName || String(pipeline._projectId) || 'unknown',
    title: `Pipeline #${pipeline.id} — ${pipeline.ref || 'unknown-ref'}`,
    status: statusMap[pipeline.status] || pipeline.status || 'unknown',
    severity,
    assignee: null,
    author: pipeline.user?.username || null,
    createdAt: safeDate(pipeline.created_at),
    updatedAt: safeDate(pipeline.updated_at),
    dueDate: null,
    metrics: { duration: pipeline.duration ?? null },
    labels: ['gitlab', pipeline.ref || ''].filter(Boolean),
    schemaVersion: 'v1',
    runId: null,
    ingestedAt: NOW(),
  };
}

module.exports = {
  normalizeJiraIssue,
  normalizeGitHubEvent,
  normalizeQAEvent,
  normalizeCICDEvent,
};
