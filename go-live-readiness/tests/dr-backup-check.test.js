'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  evaluateGate,
  loadGateConfig,
  parseMetric,
  parsePassFlag,
  repoRootFrom,
  summarize,
} = require('../scripts/dr-backup-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadGateConfig returns dr gate thresholds', () => {
  const config = loadGateConfig(rootDir);
  assert.equal(config.thresholds.maxRecoveryMinutes, 120);
  assert.equal(config.thresholds.maxDataLossMinutes, 15);
});

test('parseMetric extracts numeric values', () => {
  const markdown = '- RTO Actual (minutes): 47\n- Backup Success Rate (%): 99.6\n';
  assert.equal(parseMetric(markdown, 'RTO Actual (minutes):'), 47);
  assert.equal(parseMetric(markdown, 'Backup Success Rate (%):'), 99.6);
});

test('parsePassFlag reads PASS/FAIL values', () => {
  const markdown = '- Restore Drill Completed: PASS\n';
  assert.equal(parsePassFlag(markdown, 'Restore Drill Completed:'), true);
});

test('evaluateGate passes for current DR evidence', () => {
  const report = evaluateGate(rootDir, loadGateConfig(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize returns fail on error checks', () => {
  const report = summarize([
    { name: 'threshold.rtoActualMinutes', ok: false, severity: 'error', detail: 'actual=180, target=120' },
  ], { reportPath: 'x', metrics: {} });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
});
