#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function repoRootFrom(scriptDir = __dirname) {
  return path.resolve(scriptDir, '..', '..');
}

function loadGateConfig(rootDir) {
  const filePath = path.join(rootDir, 'go-live-readiness', 'config', 'weekly-report-gate.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    return null;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseMetric(markdown, label) {
  const safeLabel = escapeRegex(label);
  const pattern = new RegExp(`\\-\\s*${safeLabel}\\s*([0-9]+(?:\\.[0-9]+)?)`, 'i');
  const match = markdown.match(pattern);
  return match ? Number(match[1]) : null;
}

function parsePassFlag(markdown, label) {
  const safeLabel = escapeRegex(label);
  const pattern = new RegExp(`\\-\\s*${safeLabel}\\s*(PASS|FAIL)`, 'i');
  const match = markdown.match(pattern);
  return match ? match[1].toUpperCase() === 'PASS' : null;
}

function evaluateGate(rootDir, gateConfig) {
  const reportPath = path.join(rootDir, gateConfig.reportFile);
  const content = safeRead(reportPath);
  const checks = [];

  checks.push({
    name: 'report.file',
    ok: Boolean(content),
    severity: 'error',
    detail: reportPath,
  });

  if (!content) {
    return summarize(checks, { reportPath, metrics: {} });
  }

  const missingMarkers = (gateConfig.requiredMarkers || []).filter((marker) => !content.includes(marker));
  checks.push({
    name: 'report.markers',
    ok: missingMarkers.length === 0,
    severity: 'error',
    detail: missingMarkers.length === 0 ? 'All required markers present' : `Missing: ${missingMarkers.join(', ')}`,
  });

  const metrics = {
    recipientsDelivered: parseMetric(content, 'Recipients Delivered:'),
    deliverySuccessPct: parseMetric(content, 'Delivery Success Rate (%):'),
    failedDeliveries: parseMetric(content, 'Failed Deliveries:'),
    dispatchCompleted: parsePassFlag(content, 'Dispatch Completed:'),
  };

  checks.push({
    name: 'threshold.recipientsDelivered',
    ok: typeof metrics.recipientsDelivered === 'number'
      && metrics.recipientsDelivered >= gateConfig.thresholds.minRecipientsDelivered,
    severity: 'error',
    detail: `value=${metrics.recipientsDelivered}, minimum>=${gateConfig.thresholds.minRecipientsDelivered}`,
  });

  checks.push({
    name: 'threshold.deliverySuccessPct',
    ok: typeof metrics.deliverySuccessPct === 'number'
      && metrics.deliverySuccessPct >= gateConfig.thresholds.minDeliverySuccessPct,
    severity: 'error',
    detail: `value=${metrics.deliverySuccessPct}, minimum>=${gateConfig.thresholds.minDeliverySuccessPct}`,
  });

  checks.push({
    name: 'threshold.failedDeliveries',
    ok: typeof metrics.failedDeliveries === 'number' && metrics.failedDeliveries === 0,
    severity: 'error',
    detail: typeof metrics.failedDeliveries === 'number'
      ? `value=${metrics.failedDeliveries}, required=0`
      : 'value missing, required=0',
  });

  checks.push({
    name: 'flag.dispatchCompleted',
    ok: metrics.dispatchCompleted === true,
    severity: 'error',
    detail: metrics.dispatchCompleted === null ? 'value missing' : `value=${metrics.dispatchCompleted ? 'PASS' : 'FAIL'}`,
  });

  return summarize(checks, { reportPath, metrics });
}

function summarize(checks, metadata) {
  const failures = checks.filter((check) => !check.ok && check.severity === 'error').length;
  return {
    status: failures === 0 ? 'pass' : 'fail',
    summary: {
      checksRun: checks.length,
      failures,
    },
    checks,
    metadata,
  };
}

function printReport(report) {
  console.log(`Status: ${report.status.toUpperCase()}`);
  console.log(`Checks: ${report.summary.checksRun} | Failures: ${report.summary.failures}`);
  console.log(`Report: ${report.metadata.reportPath}`);
  console.log('');

  for (const check of report.checks) {
    const state = check.ok ? 'PASS' : 'FAIL';
    console.log(`- ${state} ${check.name}: ${check.detail}`);
  }
}

async function main(argv = process.argv.slice(2)) {
  const rootDir = repoRootFrom();
  const gateConfig = loadGateConfig(rootDir);
  const json = argv.includes('--json');
  const report = evaluateGate(rootDir, gateConfig);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }

  if (report.status !== 'pass') {
    process.exitCode = 1;
  }

  return report;
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluateGate,
  loadGateConfig,
  parseMetric,
  parsePassFlag,
  repoRootFrom,
  summarize,
};
