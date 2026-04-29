'use strict';

const { normalizeJiraIssue } = require('../src/normalizer/normalizer');

/**
 * Unit tests for JiraConnector normalisation logic.
 * US-E-101-03 / acceptance: normalizer produces valid NormalizedEvent for well-formed input.
 */

const makeIssue = (overrides = {}) => ({
  key: 'PROJ-42',
  id: '10042',
  fields: {
    summary: 'Fix login timeout bug',
    status: {
      name: 'In Progress',
      statusCategory: { key: 'indeterminate' },
    },
    priority: { name: 'High' },
    assignee: { emailAddress: 'alice@example.com', displayName: 'Alice' },
    reporter: { emailAddress: 'bob@example.com', displayName: 'Bob' },
    project: { key: 'PROJ', name: 'My Project' },
    issuetype: { name: 'Story' },
    created: '2024-01-15T08:00:00.000Z',
    updated: '2024-03-20T12:00:00.000Z',
    duedate: '2024-04-01',
    customfield_10016: 5,
    customfield_10028: null,
    labels: ['backend', 'auth'],
    comment: { total: 3 },
    ...overrides.fields,
  },
  ...overrides,
});

describe('normalizeJiraIssue', () => {
  test('produces expected NormalizedEvent fields', () => {
    const event = normalizeJiraIssue(makeIssue());

    expect(event.id).toBe('PROJ-42');
    expect(event.rawId).toBe('10042');
    expect(event.source).toBe('jira');
    expect(event.eventType).toBe('issue');
    expect(event.project).toBe('PROJ');
    expect(event.title).toBe('Fix login timeout bug');
    expect(event.status).toBe('in_progress');
    expect(event.severity).toBe('high');
    expect(event.assignee).toBe('alice@example.com');
    expect(event.author).toBe('bob@example.com');
    expect(event.metrics.storyPoints).toBe(5);
    expect(event.metrics.commentCount).toBe(3);
    expect(event.labels).toEqual(['backend', 'auth']);
    expect(event.schemaVersion).toBe('v1');
    expect(event.dueDate).toBeGreaterThan(0);
  });

  test('maps Critical priority to critical severity', () => {
    const event = normalizeJiraIssue(
      makeIssue({ fields: { priority: { name: 'Critical' } } })
    );
    expect(event.severity).toBe('critical');
  });

  test('maps Blocker priority to critical severity', () => {
    const event = normalizeJiraIssue(
      makeIssue({ fields: { priority: { name: 'Blocker' } } })
    );
    expect(event.severity).toBe('critical');
  });

  test('maps unknown priority to unknown severity', () => {
    const event = normalizeJiraIssue(
      makeIssue({ fields: { priority: { name: 'WhatEver' } } })
    );
    expect(event.severity).toBe('unknown');
  });

  test('handles missing assignee gracefully', () => {
    const event = normalizeJiraIssue(
      makeIssue({ fields: { assignee: null } })
    );
    expect(event.assignee).toBeNull();
  });

  test('handles missing duedate (returns null)', () => {
    const event = normalizeJiraIssue(
      makeIssue({ fields: { duedate: null } })
    );
    expect(event.dueDate).toBeNull();
  });

  test('prefers next-gen storyPoints field (customfield_10028) over classic', () => {
    const event = normalizeJiraIssue(
      makeIssue({ fields: { customfield_10028: 8, customfield_10016: 3 } })
    );
    expect(event.metrics.storyPoints).toBe(8);
  });

  test('maps Done status category correctly', () => {
    const event = normalizeJiraIssue(
      makeIssue({
        fields: {
          status: { name: 'Done', statusCategory: { key: 'done' } },
        },
      })
    );
    expect(event.status).toBe('done');
  });
});
