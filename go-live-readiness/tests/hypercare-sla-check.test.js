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
} = require('../scripts/hypercare-sla-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadGateConfig returns hypercare threshold config', () => {
  const config = loadGateConfig(rootDir);
  assert.equal(config.minimumWindowDays, 14);
  assert.equal(config.thresholds.apiAvailabilityPct, 99.5);
});

test('parseMetric extracts numeric values', () => {
  const markdown = '- API Availability (%): 99.7\n- API p95 (ms): 88\n';
  assert.equal(parseMetric(markdown, 'API Availability (%):'), 99.7);
  assert.equal(parseMetric(markdown, 'API p95 (ms):'), 88);
});

test('parsePassFlag reads SLA PASS/FAIL', () => {
  const markdown = '- SLA Adherence: PASS\n';
  assert.equal(parsePassFlag(markdown, 'SLA Adherence:'), true);
});

test('evaluateGate passes for current hypercare evidence', () => {
  const report = evaluateGate(rootDir, loadGateConfig(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize returns fail on error checks', () => {
  const report = summarize([
    { name: 'window.minimumDays', ok: false, severity: 'error', detail: 'value=7, minimum>=14' },
  ], { reportPath: 'x', metrics: {} });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
});
