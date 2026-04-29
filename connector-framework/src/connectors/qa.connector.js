'use strict';

const axios = require('axios');
const BaseConnector = require('./base.connector');
const { normalizeQAEvent } = require('../normalizer/normalizer');
const config = require('../config/connector.config');

/**
 * QAConnector — ingests test-suite results from a QA reporting endpoint.
 *
 * Designed to work with any test management tool (TestNG, Allure, Jest HTML
 * reporter, etc.) that exposes a REST API returning test run summaries.
 * Falls back to parsing a generic test-result schema if the tool is unknown.
 *
 * PRD references: FR-01, BE-01, MW-02
 */
class QAConnector extends BaseConnector {
  constructor(cfg = config.qa) {
    super({
      ...cfg,
      retryAttempts: config.queue.retryAttempts,
      retryDelayMs: config.queue.retryDelayMs,
    });

    if (!cfg.reportUrl) {
      throw new Error('QAConnector: QA_REPORT_URL must be set');
    }

    this._client = axios.create({
      baseURL: cfg.reportUrl,
      headers: cfg.apiToken
        ? { Authorization: `Bearer ${cfg.apiToken}` }
        : {},
      timeout: 15000,
    });

    this._tool = cfg.tool || 'custom';
  }

  get name() { return 'QAConnector'; }
  get source() { return 'qa'; }

  /**
   * Fetch the latest test run reports.
   * Endpoint convention: GET /runs?limit=50 returns an array of test-run objects.
   */
  async _fetch() {
    const response = await this._client.get('/runs', {
      params: { limit: 50, sort: '-executedAt' },
    });

    // Normalise to always return an array regardless of response envelope
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.runs)) return data.runs;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  }

  /**
   * @param {object} rawRun - raw test-run object from the QA tool
   */
  _normalize(rawRun) {
    return normalizeQAEvent(rawRun, this._tool);
  }
}

module.exports = QAConnector;
