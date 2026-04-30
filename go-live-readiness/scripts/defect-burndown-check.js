#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function repoRootFrom(scriptDir = __dirname) {
  return path.resolve(scriptDir, '..', '..');
}

function loadGateConfig(rootDir) {
  const configPath = path.join(rootDir, 'go-live-readiness', 'config', 'defect-burndown-gate.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    return null;
  }
}

function parseCount(markdown, label) {
  const pattern = new RegExp(`\\-\\s*${label}\\s*(\\d+)`, 'i');
  const match = markdown.match(pattern);
  return match ? Number(match[1]) : null;
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
    return summarize(checks, {
      reportPath,
      counts: {},
    });
  }

  const markers = gateConfig.requiredMarkers || [];
  const missingMarkers = markers.filter((marker) => !content.includes(marker));
  checks.push({
    name: 'report.markers',
    ok: missingMarkers.length === 0,
    severity: 'error',
    detail: missingMarkers.length === 0 ? 'All required markers present' : `Missing: ${missingMarkers.join(', ')}`,
  });

  const counts = {
    critical: parseCount(content, 'Open Critical Defects:'),
    blocker: parseCount(content, 'Open Blocker Defects:'),
    sev1Incidents: parseCount(content, 'Open Sev-1 Incidents:'),
    sev2Incidents: parseCount(content, 'Open Sev-2 Incidents:'),
  };

  for (const [key, threshold] of Object.entries(gateConfig.thresholds || {})) {
    const value = counts[key];
    checks.push({
      name: `threshold.${key}`,
      ok: typeof value === 'number' && value <= threshold,
      severity: 'error',
      detail:
        typeof value === 'number'
          ? `value=${value}, threshold<=${threshold}`
          : `value missing, threshold<=${threshold}`,
    });
  }

  return summarize(checks, {
    reportPath,
    counts,
  });
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
  parseCount,
  repoRootFrom,
  summarize,
};
