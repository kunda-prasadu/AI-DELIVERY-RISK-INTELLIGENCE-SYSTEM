#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function repoRootFrom(scriptDir = __dirname) {
  return path.resolve(scriptDir, '..', '..');
}

function loadGateConfig(rootDir) {
  const filePath = path.join(rootDir, 'go-live-readiness', 'config', 'dr-backup-gate.json');
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
    rtoTargetMinutes: parseMetric(content, 'RTO Target (minutes):'),
    rtoActualMinutes: parseMetric(content, 'RTO Actual (minutes):'),
    rpoTargetMinutes: parseMetric(content, 'RPO Target (minutes):'),
    rpoActualMinutes: parseMetric(content, 'RPO Actual (minutes):'),
    backupSuccessPct: parseMetric(content, 'Backup Success Rate (%):'),
    restoreValidationPct: parseMetric(content, 'Restore Validation Pass Rate (%):'),
    restoreDrillCompleted: parsePassFlag(content, 'Restore Drill Completed:'),
    singleNodeFailureNoDataLoss: parsePassFlag(content, 'Single-Node Failure Data Loss:'),
  };

  checks.push({
    name: 'threshold.rtoActualMinutes',
    ok: typeof metrics.rtoActualMinutes === 'number' && typeof metrics.rtoTargetMinutes === 'number'
      && metrics.rtoActualMinutes <= metrics.rtoTargetMinutes
      && metrics.rtoActualMinutes <= gateConfig.thresholds.maxRecoveryMinutes,
    severity: 'error',
    detail: `actual=${metrics.rtoActualMinutes}, target=${metrics.rtoTargetMinutes}, max=${gateConfig.thresholds.maxRecoveryMinutes}`,
  });

  checks.push({
    name: 'threshold.rpoActualMinutes',
    ok: typeof metrics.rpoActualMinutes === 'number' && typeof metrics.rpoTargetMinutes === 'number'
      && metrics.rpoActualMinutes <= metrics.rpoTargetMinutes
      && metrics.rpoActualMinutes <= gateConfig.thresholds.maxDataLossMinutes,
    severity: 'error',
    detail: `actual=${metrics.rpoActualMinutes}, target=${metrics.rpoTargetMinutes}, max=${gateConfig.thresholds.maxDataLossMinutes}`,
  });

  checks.push({
    name: 'threshold.backupSuccessPct',
    ok: typeof metrics.backupSuccessPct === 'number'
      && metrics.backupSuccessPct >= gateConfig.thresholds.minBackupSuccessPct,
    severity: 'error',
    detail: `value=${metrics.backupSuccessPct}, minimum>=${gateConfig.thresholds.minBackupSuccessPct}`,
  });

  checks.push({
    name: 'threshold.restoreValidationPct',
    ok: typeof metrics.restoreValidationPct === 'number'
      && metrics.restoreValidationPct >= gateConfig.thresholds.minRestoreValidationPct,
    severity: 'error',
    detail: `value=${metrics.restoreValidationPct}, minimum>=${gateConfig.thresholds.minRestoreValidationPct}`,
  });

  checks.push({
    name: 'flag.restoreDrillCompleted',
    ok: metrics.restoreDrillCompleted === true,
    severity: 'error',
    detail: metrics.restoreDrillCompleted === null ? 'value missing' : `value=${metrics.restoreDrillCompleted ? 'PASS' : 'FAIL'}`,
  });

  checks.push({
    name: 'flag.singleNodeFailureNoDataLoss',
    ok: metrics.singleNodeFailureNoDataLoss === true,
    severity: 'error',
    detail: metrics.singleNodeFailureNoDataLoss === null
      ? 'value missing'
      : `value=${metrics.singleNodeFailureNoDataLoss ? 'PASS' : 'FAIL'}`,
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
