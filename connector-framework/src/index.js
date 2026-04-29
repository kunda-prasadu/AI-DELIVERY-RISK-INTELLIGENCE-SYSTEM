'use strict';

require('dotenv').config();

const queueManager = require('./queue/queue.manager');
const config = require('./config/connector.config');
const logger = require('./middleware/logger');

// ── Conditional connector imports ────────────────────────────────────────────
// Only instantiate connectors whose required config is present.
// This allows partial deployments (e.g. Jira-only) without crashing.

function buildConnectors() {
  const connectors = [];

  if (config.jira.baseUrl && config.jira.apiToken) {
    const JiraConnector = require('./connectors/jira.connector');
    connectors.push({
      connector: new JiraConnector(),
      cron: config.cron.jira,
    });
    logger.info('[Bootstrap] JiraConnector enabled');
  } else {
    logger.warn('[Bootstrap] JiraConnector disabled — JIRA_BASE_URL / JIRA_API_TOKEN not set');
  }

  if (config.github.token) {
    const GitHubConnector = require('./connectors/github.connector');
    connectors.push({
      connector: new GitHubConnector(),
      cron: config.cron.github,
    });
    logger.info('[Bootstrap] GitHubConnector enabled');
  } else {
    logger.warn('[Bootstrap] GitHubConnector disabled — GITHUB_TOKEN not set');
  }

  if (config.qa.reportUrl) {
    const QAConnector = require('./connectors/qa.connector');
    connectors.push({
      connector: new QAConnector(),
      cron: config.cron.qa,
    });
    logger.info('[Bootstrap] QAConnector enabled');
  } else {
    logger.warn('[Bootstrap] QAConnector disabled — QA_REPORT_URL not set');
  }

  if (config.cicd.token) {
    const CICDConnector = require('./connectors/cicd.connector');
    connectors.push({
      connector: new CICDConnector(),
      cron: config.cron.cicd,
    });
    logger.info('[Bootstrap] CICDConnector enabled');
  } else {
    logger.warn('[Bootstrap] CICDConnector disabled — CICD_TOKEN not set');
  }

  return connectors;
}

function main() {
  logger.info('=== AI Delivery Risk — Connector Framework starting ===', {
    env: config.env,
    version: '1.0.0',
  });

  const connectors = buildConnectors();

  if (connectors.length === 0) {
    logger.error('[Bootstrap] No connectors configured — check your .env file. Exiting.');
    process.exit(1);
  }

  for (const { connector, cron } of connectors) {
    queueManager.register(connector, cron);
  }

  queueManager.start();

  logger.info('[Bootstrap] All connectors scheduled. Service running.');

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal) => {
    logger.info(`[Bootstrap] ${signal} received — shutting down gracefully`);
    queueManager.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error('[Bootstrap] Uncaught exception', { error: err.message, stack: err.stack });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('[Bootstrap] Unhandled promise rejection', { reason: String(reason) });
  });
}

main();
