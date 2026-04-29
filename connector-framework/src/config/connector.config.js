'use strict';

require('dotenv').config();

/**
 * Central configuration for all connectors.
 * All values come from environment variables — no secrets hard-coded here.
 */
const config = {
  env: process.env.NODE_ENV || 'development',

  jira: {
    baseUrl: process.env.JIRA_BASE_URL || '',
    email: process.env.JIRA_EMAIL || '',
    apiToken: process.env.JIRA_API_TOKEN || '',
    projectKeys: (process.env.JIRA_PROJECT_KEYS || '').split(',').filter(Boolean),
    maxResults: 100,
  },

  github: {
    token: process.env.GITHUB_TOKEN || '',
    org: process.env.GITHUB_ORG || '',
    repos: (process.env.GITHUB_REPOS || '').split(',').filter(Boolean),
    apiBase: 'https://api.github.com',
    perPage: 100,
  },

  qa: {
    tool: process.env.QA_TOOL || 'custom',
    reportUrl: process.env.QA_REPORT_URL || '',
    apiToken: process.env.QA_API_TOKEN || '',
  },

  cicd: {
    provider: process.env.CICD_PROVIDER || 'github_actions',
    apiUrl: process.env.CICD_API_URL || 'https://api.github.com',
    token: process.env.CICD_TOKEN || '',
  },

  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.QUEUE_RETRY_DELAY_MS || '2000', 10),
    dlqMaxSize: parseInt(process.env.DLQ_MAX_SIZE || '500', 10),
  },

  cron: {
    jira: process.env.CRON_JIRA || '*/15 * * * *',
    github: process.env.CRON_GITHUB || '*/10 * * * *',
    qa: process.env.CRON_QA || '0 * * * *',
    cicd: process.env.CRON_CICD || '*/5 * * * *',
  },

  downstream: {
    webhookUrl: process.env.DOWNSTREAM_WEBHOOK_URL || '',
  },
};

module.exports = config;
