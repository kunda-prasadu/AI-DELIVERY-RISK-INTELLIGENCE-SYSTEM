'use strict';

const axios = require('axios');
const BaseConnector = require('./base.connector');
const { normalizeGitHubEvent } = require('../normalizer/normalizer');
const config = require('../config/connector.config');

/**
 * GitHubConnector — ingests commits, pull-requests, and workflow run statuses.
 *
 * Fetches:
 *   - Recent commits for each configured repo
 *   - Open and recently-closed pull requests
 *   - Latest GitHub Actions workflow runs
 *
 * PRD references: FR-01, BE-01
 */
class GitHubConnector extends BaseConnector {
  constructor(cfg = config.github) {
    super({
      ...cfg,
      retryAttempts: config.queue.retryAttempts,
      retryDelayMs: config.queue.retryDelayMs,
    });

    if (!cfg.token) {
      throw new Error('GitHubConnector: GITHUB_TOKEN must be set');
    }

    this._client = axios.create({
      baseURL: cfg.apiBase || 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 15000,
    });

    this._org = cfg.org || '';
    this._repos = cfg.repos || [];
    this._perPage = cfg.perPage || 30;
  }

  get name() { return 'GitHubConnector'; }
  get source() { return 'github'; }

  /**
   * Fetch commits, PRs, and workflow runs across all configured repos.
   * Returns a flat array of raw GitHub event objects, each tagged with
   * `_kind` ('commit' | 'pull_request' | 'workflow_run').
   */
  async _fetch() {
    const allEvents = [];

    for (const repo of this._repos) {
      const repoPath = this._org ? `${this._org}/${repo}` : repo;

      const [commits, pulls, workflowRuns] = await Promise.all([
        this._fetchCommits(repoPath),
        this._fetchPullRequests(repoPath),
        this._fetchWorkflowRuns(repoPath),
      ]);

      allEvents.push(...commits, ...pulls, ...workflowRuns);
    }

    return allEvents;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  async _fetchCommits(repoPath) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h
    const response = await this._client.get(`/repos/${repoPath}/commits`, {
      params: { per_page: this._perPage, since },
    });
    return response.data.map(c => ({ ...c, _kind: 'commit', _repo: repoPath }));
  }

  async _fetchPullRequests(repoPath) {
    const response = await this._client.get(`/repos/${repoPath}/pulls`, {
      params: { state: 'all', per_page: this._perPage, sort: 'updated', direction: 'desc' },
    });
    return response.data.map(pr => ({ ...pr, _kind: 'pull_request', _repo: repoPath }));
  }

  async _fetchWorkflowRuns(repoPath) {
    const response = await this._client.get(`/repos/${repoPath}/actions/runs`, {
      params: { per_page: this._perPage },
    });
    return (response.data.workflow_runs || []).map(r => ({
      ...r,
      _kind: 'workflow_run',
      _repo: repoPath,
    }));
  }

  /**
   * @param {object} rawItem - raw GitHub object tagged with _kind
   */
  _normalize(rawItem) {
    return normalizeGitHubEvent(rawItem);
  }
}

module.exports = GitHubConnector;
