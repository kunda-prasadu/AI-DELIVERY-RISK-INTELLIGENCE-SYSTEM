'use strict';

const axios = require('axios');
const BaseConnector = require('./base.connector');
const { normalizeJiraIssue } = require('../normalizer/normalizer');
const config = require('../config/connector.config');

/**
 * JiraConnector — ingests issues from one or more Jira projects.
 *
 * Uses Jira Cloud REST API v3 with Basic auth (email + API token).
 * Paginates through all open/in-progress issues and applies JQL filters.
 *
 * PRD references: FR-01, BE-01, BE-05 (role-scoped; token must have read access)
 */
class JiraConnector extends BaseConnector {
  constructor(cfg = config.jira) {
    super({
      ...cfg,
      retryAttempts: config.queue.retryAttempts,
      retryDelayMs: config.queue.retryDelayMs,
    });

    if (!cfg.baseUrl || !cfg.email || !cfg.apiToken) {
      throw new Error('JiraConnector: JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN must be set');
    }

    this._client = axios.create({
      baseURL: `${cfg.baseUrl}/rest/api/3`,
      auth: {
        username: cfg.email,
        password: cfg.apiToken,
      },
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
    });

    this._projectKeys = cfg.projectKeys || [];
    this._maxResults = cfg.maxResults || 100;
  }

  get name() { return 'JiraConnector'; }
  get source() { return 'jira'; }

  /**
   * Paginated JQL search across all configured project keys.
   * Returns array of raw Jira issue objects.
   */
  async _fetch() {
    const projectFilter = this._projectKeys.length > 0
      ? `project IN (${this._projectKeys.map(k => `"${k}"`).join(',')}) AND `
      : '';

    const jql = `${projectFilter}statusCategory != Done ORDER BY updated DESC`;

    let allIssues = [];
    let startAt = 0;
    let total = Infinity;

    while (startAt < total) {
      const response = await this._client.get('/search', {
        params: {
          jql,
          startAt,
          maxResults: this._maxResults,
          fields: [
            'summary',
            'status',
            'priority',
            'assignee',
            'reporter',
            'project',
            'issuetype',
            'created',
            'updated',
            'duedate',
            'customfield_10016', // story points (classic)
            'customfield_10028', // story points (next-gen)
            'labels',
            'fixVersions',
            'comment',
          ].join(','),
        },
      });

      const { issues, total: pageTotal } = response.data;
      total = pageTotal;
      allIssues = allIssues.concat(issues);
      startAt += issues.length;

      // Safety: stop if the API returns an empty page to avoid infinite loop
      if (issues.length === 0) break;
    }

    return allIssues;
  }

  /**
   * Transform a raw Jira issue into a NormalizedEvent.
   * @param {object} rawIssue
   */
  _normalize(rawIssue) {
    return normalizeJiraIssue(rawIssue);
  }
}

module.exports = JiraConnector;
