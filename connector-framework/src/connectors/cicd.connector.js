'use strict';

const axios = require('axios');
const BaseConnector = require('./base.connector');
const { normalizeCICDEvent } = require('../normalizer/normalizer');
const config = require('../config/connector.config');

/**
 * CICDConnector — ingests pipeline / build-run events.
 *
 * Supports:
 *   - GitHub Actions  (via GitHub REST API)
 *   - Jenkins         (via Jenkins REST API)
 *   - GitLab CI       (via GitLab API v4)
 *
 * The provider is selected via CICD_PROVIDER env var.
 * PRD references: FR-01, BE-01
 */
class CICDConnector extends BaseConnector {
  constructor(cfg = config.cicd) {
    super({
      ...cfg,
      retryAttempts: config.queue.retryAttempts,
      retryDelayMs: config.queue.retryDelayMs,
    });

    if (!cfg.token) {
      throw new Error('CICDConnector: CICD_TOKEN must be set');
    }

    this._provider = cfg.provider || 'github_actions';
    this._apiUrl = cfg.apiUrl || 'https://api.github.com';
    this._githubConfig = config.github;

    this._client = this._buildClient(cfg);
  }

  get name() { return 'CICDConnector'; }
  get source() { return 'cicd'; }

  async _fetch() {
    switch (this._provider) {
      case 'github_actions':
        return this._fetchGitHubActions();
      case 'jenkins':
        return this._fetchJenkins();
      case 'gitlab':
        return this._fetchGitLab();
      default:
        throw new Error(`CICDConnector: unknown provider "${this._provider}"`);
    }
  }

  _normalize(rawRun) {
    return normalizeCICDEvent(rawRun, this._provider);
  }

  // ── Provider-specific fetchers ─────────────────────────────────────────────

  async _fetchGitHubActions() {
    const repos = this._githubConfig.repos || [];
    const org = this._githubConfig.org || '';
    const allRuns = [];

    for (const repo of repos) {
      const repoPath = org ? `${org}/${repo}` : repo;
      const response = await this._client.get(`/repos/${repoPath}/actions/runs`, {
        params: { per_page: 25 },
      });
      const runs = (response.data.workflow_runs || []).map(r => ({
        ...r,
        _provider: 'github_actions',
        _repo: repoPath,
      }));
      allRuns.push(...runs);
    }

    return allRuns;
  }

  async _fetchJenkins() {
    // Jenkins: GET <baseUrl>/api/json?tree=jobs[name,builds[number,result,timestamp,duration]]
    const response = await this._client.get('/api/json', {
      params: { tree: 'jobs[name,builds[number,result,timestamp,duration,url]]', depth: 1 },
    });

    const jobs = response.data.jobs || [];
    const runs = [];

    for (const job of jobs) {
      for (const build of (job.builds || [])) {
        runs.push({ ...build, _provider: 'jenkins', _jobName: job.name });
      }
    }

    return runs;
  }

  async _fetchGitLab() {
    // GitLab: GET /projects (then pipelines per project)
    const projectsRes = await this._client.get('/projects', {
      params: { membership: true, per_page: 20, order_by: 'last_activity_at' },
    });

    const projects = projectsRes.data || [];
    const allPipelines = [];

    for (const project of projects) {
      const pipelinesRes = await this._client.get(`/projects/${project.id}/pipelines`, {
        params: { per_page: 10, order_by: 'updated_at' },
      });
      const pipelines = (pipelinesRes.data || []).map(p => ({
        ...p,
        _provider: 'gitlab',
        _projectName: project.name_with_namespace,
        _projectId: project.id,
      }));
      allPipelines.push(...pipelines);
    }

    return allPipelines;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _buildClient(cfg) {
    const headers = { 'Content-Type': 'application/json' };

    if (cfg.provider === 'github_actions') {
      headers['Authorization'] = `Bearer ${cfg.token}`;
      headers['Accept'] = 'application/vnd.github+json';
      headers['X-GitHub-Api-Version'] = '2022-11-28';
    } else if (cfg.provider === 'jenkins') {
      // Jenkins uses HTTP Basic auth — token is "user:apiToken" base64 string
      headers['Authorization'] = `Basic ${Buffer.from(cfg.token).toString('base64')}`;
    } else if (cfg.provider === 'gitlab') {
      headers['PRIVATE-TOKEN'] = cfg.token;
    }

    return axios.create({
      baseURL: cfg.apiUrl,
      headers,
      timeout: 15000,
    });
  }
}

module.exports = CICDConnector;
