#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function repoRootFrom(scriptDir = __dirname) {
  return path.resolve(scriptDir, '..', '..');
}

function loadGateConfig(rootDir) {
  const filePath = path.join(rootDir, 'go-live-readiness', 'config', 'hypercare-sla-gate.json');
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
    hypercareWindowDays: parseMetric(content, 'Hypercare Window (days):'),
    apiAvailabilityPct: parseMetric(content, 'API Availability (%):'),
    dashboardAvailabilityPct: parseMetric(content, 'Dashboard Availability (%):'),
    p95ApiMs: parseMetric(content, 'API p95 (ms):'),
    p95DashboardMs: parseMetric(content, 'Dashboard p95 (ms):'),
    sev1Incidents: parseMetric(content, 'Open Sev-1 Incidents:'),
    sev2IncidentHours: parseMetric(content, 'Open Sev-2 Incident Hours:'),
    slaAdherence: parsePassFlag(content, 'SLA Adherence:'),
  };

  checks.push({
    name: 'window.minimumDays',
    ok: typeof metrics.hypercareWindowDays === 'number' && metrics.hypercareWindowDays >= gateConfig.minimumWindowDays,
    severity: 'error',
    detail: typeof metrics.hypercareWindowDays === 'number'
      ? `value=${metrics.hypercareWindowDays}, minimum>=${gateConfig.minimumWindowDays}`
      : `value missing, minimum>=${gateConfig.minimumWindowDays}`,
  });

  for (const [key, threshold] of Object.entries(gateConfig.thresholds || {})) {
    const value = metrics[key];
    let ok = false;

    if (typeof value === 'number') {
      if (key.endsWith('AvailabilityPct')) {
        ok = value >= threshold;
      } else if (key.startsWith('p95')) {
        ok = value <= threshold;
      } else {
        ok = value <= threshold;
      }
    }

    checks.push({
      name: `threshold.${key}`,
      ok,
      severity: 'error',
      detail: typeof value === 'number'
        ? `value=${value}, threshold=${threshold}`
        : `value missing, threshold=${threshold}`,
    });
  }

  checks.push({
    name: 'sla.flag',
    ok: metrics.slaAdherence === true,
    severity: 'error',
    detail: metrics.slaAdherence === null ? 'value missing' : `value=${metrics.slaAdherence ? 'PASS' : 'FAIL'}`,
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
  escapeRegex,
  evaluateGate,
  loadGateConfig,
  parseMetric,
  parsePassFlag,
  repoRootFrom,
  summarize,
};
