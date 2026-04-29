'use strict';

const cron = require('node-cron');
const axios = require('axios');
const schemaValidator = require('../middleware/schema.validator');
const dlq = require('./dead-letter.handler');
const logger = require('../middleware/logger');
const config = require('../config/connector.config');

/**
 * QueueManager — orchestrates all connectors and manages the event pipeline.
 *
 * Responsibilities:
 *  1. Register connectors and schedule them on cron intervals (PRD FR-01)
 *  2. Listen to 'data' events → validate schema (MW-02) → forward downstream
 *  3. Listen to 'error' events → push to DLQ (MW-01, BE-01)
 *  4. Provide start() / stop() lifecycle controls
 *
 * Concurrency is managed per connector — each connector run is sequential
 * within its own schedule to prevent overlapping runs flooding the API.
 */
class QueueManager {
  constructor() {
    /** @type {Map<string, {connector: BaseConnector, cronExpression: string, task: cron.ScheduledTask|null, running: boolean}>} */
    this._connectors = new Map();
    this._started = false;
  }

  /**
   * Register a connector with a cron expression.
   * @param {import('../connectors/base.connector')} connector
   * @param {string} cronExpression - standard 5-field cron syntax
   */
  register(connector, cronExpression) {
    if (this._connectors.has(connector.name)) {
      throw new Error(`QueueManager: connector "${connector.name}" is already registered`);
    }

    this._connectors.set(connector.name, {
      connector,
      cronExpression,
      task: null,
      running: false,
    });

    // Wire up event handlers immediately (before scheduling)
    connector.on('data', (event) => this._handleDataEvent(event, connector.name));
    connector.on('error', (payload) => this._handleErrorEvent(payload, connector.name));

    logger.info(`[QueueManager] Registered ${connector.name} @ "${cronExpression}"`);
  }

  /**
   * Start all registered cron schedules.
   */
  start() {
    if (this._started) return;

    for (const [name, entry] of this._connectors.entries()) {
      if (!cron.validate(entry.cronExpression)) {
        logger.error(`[QueueManager] Invalid cron expression for ${name}: "${entry.cronExpression}"`);
        continue;
      }

      entry.task = cron.schedule(entry.cronExpression, async () => {
        if (entry.running) {
          logger.warn(`[QueueManager] ${name} previous run still in progress — skipping tick`);
          return;
        }
        entry.running = true;
        try {
          await entry.connector.run();
        } finally {
          entry.running = false;
        }
      });

      logger.info(`[QueueManager] Scheduled ${name}`);
    }

    this._started = true;
    logger.info(`[QueueManager] Started — ${this._connectors.size} connector(s) scheduled`);
  }

  /**
   * Stop all cron tasks gracefully.
   */
  stop() {
    for (const [name, entry] of this._connectors.entries()) {
      if (entry.task) {
        entry.task.stop();
        logger.info(`[QueueManager] Stopped ${name}`);
      }
    }
    this._started = false;
  }

  /**
   * Trigger a connector immediately (outside of its cron schedule).
   * Useful for on-demand refresh or integration tests.
   * @param {string} connectorName
   */
  async runNow(connectorName) {
    const entry = this._connectors.get(connectorName);
    if (!entry) throw new Error(`QueueManager: connector "${connectorName}" not found`);
    if (entry.running) throw new Error(`QueueManager: "${connectorName}" is already running`);

    entry.running = true;
    try {
      return await entry.connector.run();
    } finally {
      entry.running = false;
    }
  }

  /**
   * Return summary status of all registered connectors.
   */
  status() {
    const result = {};
    for (const [name, entry] of this._connectors.entries()) {
      result[name] = {
        cron: entry.cronExpression,
        running: entry.running,
        dlqSize: dlq.size,
      };
    }
    return result;
  }

  // ── Private handlers ────────────────────────────────────────────────────────

  /**
   * Validate a normalized event then forward it downstream.
   * Invalid events are logged and dropped — not forwarded (MW-02).
   */
  async _handleDataEvent(event, connectorName) {
    const { valid, errors, value } = schemaValidator.validate(event);

    if (!valid) {
      logger.warn(`[QueueManager] Schema validation failed — event dropped`, {
        connectorName,
        eventId: event.id,
        errors,
      });
      return;
    }

    await this._forwardDownstream(value);
  }

  /**
   * Route failed connector runs to the DLQ.
   */
  _handleErrorEvent(payload, connectorName) {
    dlq.push({
      runId: payload.runId,
      source: payload.source,
      error: payload.error,
      context: { connectorName },
    });
  }

  /**
   * Forward a validated NormalizedEvent to the downstream webhook (if configured).
   * In a full production setup this would publish to Kafka / Redis Streams.
   */
  async _forwardDownstream(event) {
    const url = config.downstream.webhookUrl;
    if (!url) return;

    try {
      await axios.post(url, event, { timeout: 5000 });
    } catch (err) {
      // Forwarding failures are non-fatal — log and continue
      logger.warn('[QueueManager] Downstream forward failed', {
        eventId: event.id,
        error: err.message,
      });
    }
  }
}

module.exports = new QueueManager();
