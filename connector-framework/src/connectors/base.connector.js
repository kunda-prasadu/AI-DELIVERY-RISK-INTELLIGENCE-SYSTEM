'use strict';

const { EventEmitter } = require('events');
const retry = require('async-retry');
const { v4: uuidv4 } = require('uuid');
const logger = require('../middleware/logger');
const auditLogger = require('../middleware/audit.logger');

/**
 * BaseConnector — abstract base class for all data-source connectors.
 *
 * Responsibilities (PRD FR-01, BE-01, MW-01):
 *  - Enforce a standard fetch() lifecycle with retry + dead-letter
 *  - Emit 'data' events with normalised payloads for downstream consumers
 *  - Emit 'error' events so the queue manager can route to DLQ
 *  - Produce an audit record for every ingestion cycle (MW-03)
 *
 * Subclasses MUST implement:
 *   - get name()       — human-readable connector identifier
 *   - get source()     — 'jira' | 'github' | 'qa' | 'cicd'
 *   - _fetch()         — raw API call; returns array of raw items
 *   - _normalize(raw)  — transforms one raw item into a NormalizedEvent
 */
class BaseConnector extends EventEmitter {
  /**
   * @param {object} config - source-specific config block from connector.config.js
   */
  constructor(config = {}) {
    super();
    this.config = config;
    this.isRunning = false;
    this._retryAttempts = config.retryAttempts || 3;
    this._retryDelayMs = config.retryDelayMs || 2000;
  }

  // ── Must be overridden ────────────────────────────────────────────────────

  /** @returns {string} */
  get name() {
    throw new Error('BaseConnector: name getter must be overridden');
  }

  /** @returns {'jira'|'github'|'qa'|'cicd'} */
  get source() {
    throw new Error('BaseConnector: source getter must be overridden');
  }

  /**
   * Fetch raw data from the external API.
   * @returns {Promise<Array>}
   */
  async _fetch() {
    throw new Error('BaseConnector: _fetch() must be overridden');
  }

  /**
   * Normalize one raw API item into a NormalizedEvent.
   * @param {object} rawItem
   * @returns {NormalizedEvent}
   */
  _normalize(rawItem) {
    throw new Error('BaseConnector: _normalize() must be overridden');
  }

  // ── Public lifecycle ──────────────────────────────────────────────────────

  /**
   * Execute a full ingestion cycle with retry + dead-letter routing.
   * Called by the QueueManager on each cron tick.
   * @returns {Promise<{success: boolean, count: number, errors: Array}>}
   */
  async run() {
    const runId = uuidv4();
    const startedAt = new Date().toISOString();
    this.isRunning = true;

    logger.info(`[${this.name}] Ingestion cycle started`, { runId, source: this.source });

    let rawItems = [];
    let normalizedEvents = [];
    const errors = [];

    try {
      rawItems = await retry(
        async (bail) => {
          try {
            return await this._fetch();
          } catch (err) {
            // Do not retry on authentication / authorization errors
            if (err.response && [401, 403].includes(err.response.status)) {
              bail(err);
            }
            throw err;
          }
        },
        {
          retries: this._retryAttempts,
          minTimeout: this._retryDelayMs,
          onRetry: (err, attempt) => {
            logger.warn(`[${this.name}] Retry attempt ${attempt}`, {
              runId,
              error: err.message,
            });
          },
        }
      );
    } catch (fetchErr) {
      logger.error(`[${this.name}] All retries exhausted — routing to DLQ`, {
        runId,
        error: fetchErr.message,
      });

      auditLogger.record({
        runId,
        source: this.source,
        connector: this.name,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'DLQ',
        count: 0,
        error: fetchErr.message,
      });

      this.emit('error', { runId, source: this.source, error: fetchErr });
      this.isRunning = false;
      return { success: false, count: 0, errors: [fetchErr.message] };
    }

    // Normalize each raw item; catch per-item failures so one bad record
    // does not abort the whole batch (MW-02: invalid events logged + skipped)
    for (const raw of rawItems) {
      try {
        const event = this._normalize(raw);
        event.runId = runId;
        normalizedEvents.push(event);
      } catch (normErr) {
        logger.warn(`[${this.name}] Normalization failed for one record — skipping`, {
          runId,
          error: normErr.message,
          raw: JSON.stringify(raw).slice(0, 200),
        });
        errors.push(normErr.message);
      }
    }

    // Emit normalized events for downstream consumers
    for (const event of normalizedEvents) {
      this.emit('data', event);
    }

    auditLogger.record({
      runId,
      source: this.source,
      connector: this.name,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: 'OK',
      count: normalizedEvents.length,
      skipped: errors.length,
    });

    logger.info(`[${this.name}] Ingestion cycle complete`, {
      runId,
      fetched: rawItems.length,
      normalized: normalizedEvents.length,
      skipped: errors.length,
    });

    this.isRunning = false;
    return { success: true, count: normalizedEvents.length, errors };
  }
}

module.exports = BaseConnector;
