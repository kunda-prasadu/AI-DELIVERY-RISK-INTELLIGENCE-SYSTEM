'use strict';

const logger = require('../middleware/logger');

/**
 * DeadLetterQueue — in-memory store for ingestion cycles that exhausted all retries.
 *
 * In production this would be backed by a durable store (Redis list, SQS DLQ,
 * Kafka topic). For this service we keep a bounded in-memory ring buffer and
 * expose a flush() method for a future durable-backend integration.
 *
 * PRD references: BE-01, MW-01
 */
class DeadLetterQueue {
  /**
   * @param {number} maxSize - max entries before oldest is evicted (FIFO)
   */
  constructor(maxSize = 500) {
    this._maxSize = maxSize;
    this._queue = [];
  }

  /**
   * Push a failed ingestion record into the DLQ.
   * @param {{ runId: string, source: string, error: Error|string, context?: object }} entry
   */
  push(entry) {
    const record = {
      runId: entry.runId,
      source: entry.source,
      errorMessage: entry.error instanceof Error ? entry.error.message : String(entry.error),
      errorStack: entry.error instanceof Error ? entry.error.stack : undefined,
      context: entry.context || {},
      enqueuedAt: new Date().toISOString(),
    };

    this._queue.push(record);

    logger.warn('[DLQ] Entry added', { runId: record.runId, source: record.source });

    // Evict oldest entries if buffer is full
    if (this._queue.length > this._maxSize) {
      const evicted = this._queue.shift();
      logger.warn('[DLQ] Max size reached — evicting oldest entry', {
        evictedRunId: evicted.runId,
      });
    }
  }

  /**
   * Return all pending DLQ entries (non-destructive).
   * @returns {Array}
   */
  list() {
    return [...this._queue];
  }

  /**
   * Return count of pending entries.
   */
  get size() {
    return this._queue.length;
  }

  /**
   * Remove a single DLQ entry by runId (e.g. after successful replay).
   * @param {string} runId
   * @returns {boolean} true if found and removed
   */
  remove(runId) {
    const idx = this._queue.findIndex(e => e.runId === runId);
    if (idx !== -1) {
      this._queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Drain and return all entries (destructive — for replay / flush operations).
   * @returns {Array}
   */
  flush() {
    const all = [...this._queue];
    this._queue = [];
    logger.info(`[DLQ] Flushed ${all.length} entries`);
    return all;
  }
}

module.exports = new DeadLetterQueue();
