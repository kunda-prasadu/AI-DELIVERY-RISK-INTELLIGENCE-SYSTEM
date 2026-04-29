'use strict';

const logger = require('./logger');

/**
 * AuditLogger — immutable append-only audit trail for every ingestion cycle.
 *
 * Every risk score, recommendation, and ingestion event must be traceable
 * (PRD MW-03, BE-05).
 *
 * Records include:
 *   - runId         — ingestion cycle UUID
 *   - source        — connector source ('jira' | 'github' | 'qa' | 'cicd')
 *   - connector     — connector class name
 *   - startedAt     — ISO 8601
 *   - finishedAt    — ISO 8601
 *   - status        — 'OK' | 'DLQ'
 *   - count         — number of events successfully normalized
 *   - skipped       — number of records that failed normalization
 *   - error         — error message (only when status = 'DLQ')
 *
 * In production, push these records to an append-only data store
 * (e.g. Postgres audit table, S3 log bucket, Datadog Log Management).
 * For now, records are written to the 'audit' log level and kept in memory.
 */
class AuditLogger {
  constructor() {
    /** In-memory audit log (bounded at 10 000 entries). */
    this._records = [];
    this._maxRecords = 10000;
  }

  /**
   * Record an audit entry. This is append-only — records may not be modified
   * or deleted once written.
   * @param {object} entry
   */
  record(entry) {
    const auditEntry = {
      ...entry,
      auditedAt: new Date().toISOString(),
    };

    // In-memory store (ring buffer)
    this._records.push(auditEntry);
    if (this._records.length > this._maxRecords) {
      this._records.shift(); // evict oldest — real store would never do this
    }

    // Persist to log stream (in production: structured log sink)
    logger.info('[Audit]', auditEntry);
  }

  /**
   * Return all audit records for a given source (read-only copy).
   * @param {string} [source] - filter by source; omit for all records
   * @returns {Array}
   */
  query(source) {
    if (!source) return [...this._records];
    return this._records.filter(r => r.source === source);
  }

  /**
   * Return the last N audit records.
   * @param {number} n
   */
  tail(n = 50) {
    return this._records.slice(-n);
  }
}

module.exports = new AuditLogger();
