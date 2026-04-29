'use strict';

const { normalizeGitHubEvent } = require('../src/normalizer/normalizer');

/**
 * Unit tests for GitHub normalizer — commits, PRs, workflow runs.
 * US-E-101-03
 */

describe('normalizeGitHubEvent — commit', () => {
  const rawCommit = {
    _kind: 'commit',
    _repo: 'my-org/api-service',
    sha: 'abc1234def5678',
    commit: {
      message: 'fix: resolve null pointer in auth service\n\nLong body here',
      author: { email: 'dev@example.com', date: '2024-03-18T10:00:00Z' },
      committer: { date: '2024-03-18T10:01:00Z' },
    },
    author: { login: 'dev_user' },
    stats: { additions: 12, deletions: 4 },
  };

  test('produces commit NormalizedEvent', () => {
    const event = normalizeGitHubEvent(rawCommit);
    expect(event.source).toBe('github');
    expect(event.eventType).toBe('commit');
    expect(event.id).toBe('abc1234def5678');
    expect(event.project).toBe('my-org/api-service');
    expect(event.title).toBe('fix: resolve null pointer in auth service');
    expect(event.status).toBe('committed');
    expect(event.author).toBe('dev@example.com');
    expect(event.metrics.additions).toBe(12);
    expect(event.metrics.deletions).toBe(4);
  });
});

describe('normalizeGitHubEvent — pull_request', () => {
  const rawPR = {
    _kind: 'pull_request',
    _repo: 'my-org/api-service',
    number: 99,
    id: 55555,
    title: 'feat: add rate limiting middleware',
    state: 'open',
    draft: false,
    user: { login: 'alice' },
    assignee: { login: 'bob' },
    created_at: '2024-02-01T08:00:00Z',
    updated_at: '2024-02-05T14:30:00Z',
    merged_at: null,
    additions: 200,
    deletions: 50,
    changed_files: 8,
    requested_reviewers: [{ login: 'carol' }, { login: 'dave' }],
    labels: [{ name: 'enhancement' }, { name: 'backend' }],
  };

  test('produces pull_request NormalizedEvent', () => {
    const event = normalizeGitHubEvent(rawPR);
    expect(event.source).toBe('github');
    expect(event.eventType).toBe('pull_request');
    expect(event.id).toBe('99');
    expect(event.status).toBe('open');
    expect(event.author).toBe('alice');
    expect(event.assignee).toBe('bob');
    expect(event.metrics.additions).toBe(200);
    expect(event.metrics.changedFiles).toBe(8);
    expect(event.metrics.reviewCount).toBe(2);
    expect(event.labels).toEqual(['enhancement', 'backend']);
  });

  test('merged PR maps to done status', () => {
    const event = normalizeGitHubEvent({
      ...rawPR,
      state: 'closed',
      merged_at: '2024-02-06T10:00:00Z',
    });
    expect(event.status).toBe('done');
  });

  test('closed-not-merged PR maps to closed status', () => {
    const event = normalizeGitHubEvent({
      ...rawPR,
      state: 'closed',
      merged_at: null,
    });
    expect(event.status).toBe('closed');
  });
});

describe('normalizeGitHubEvent — workflow_run', () => {
  const rawRun = {
    _kind: 'workflow_run',
    _repo: 'my-org/api-service',
    id: 9988776,
    name: 'CI Pipeline',
    run_number: 214,
    status: 'completed',
    conclusion: 'failure',
    created_at: '2024-03-20T09:00:00Z',
    updated_at: '2024-03-20T09:05:00Z',
    run_started_at: '2024-03-20T09:00:30Z',
    triggering_actor: { login: 'ci-bot' },
    run_attempt: 2,
  };

  test('produces workflow_run NormalizedEvent', () => {
    const event = normalizeGitHubEvent(rawRun);
    expect(event.source).toBe('github');
    expect(event.eventType).toBe('workflow_run');
    expect(event.title).toBe('CI Pipeline #214');
    expect(event.status).toBe('failed');
    expect(event.severity).toBe('high');
    expect(event.author).toBe('ci-bot');
    expect(event.metrics.runAttempt).toBe(2);
  });

  test('successful workflow run gets unknown severity', () => {
    const event = normalizeGitHubEvent({ ...rawRun, conclusion: 'success' });
    expect(event.status).toBe('passed');
    expect(event.severity).toBe('unknown');
  });
});

describe('normalizeGitHubEvent — unknown kind', () => {
  test('throws for unknown _kind', () => {
    expect(() => normalizeGitHubEvent({ _kind: 'something_else' })).toThrow();
  });
});
