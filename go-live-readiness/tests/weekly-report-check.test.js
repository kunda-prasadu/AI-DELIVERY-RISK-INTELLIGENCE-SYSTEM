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
} = require('../scripts/weekly-report-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadGateConfig returns weekly-report thresholds', () => {
  const config = loadGateConfig(rootDir);
  assert.equal(config.thresholds.minDeliverySuccessPct, 95);
  assert.equal(config.thresholds.minRecipientsDelivered, 1);
});

test('parseMetric extracts numeric values', () => {
  const markdown = '- Recipients Delivered: 2\n- Delivery Success Rate (%): 99.5\n';
  assert.equal(parseMetric(markdown, 'Recipients Delivered:'), 2);
  assert.equal(parseMetric(markdown, 'Delivery Success Rate (%):'), 99.5);
});

test('parsePassFlag reads PASS/FAIL values', () => {
  const markdown = '- Dispatch Completed: PASS\n';
  assert.equal(parsePassFlag(markdown, 'Dispatch Completed:'), true);
});

test('evaluateGate passes for current weekly report evidence', () => {
  const report = evaluateGate(rootDir, loadGateConfig(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize returns fail on error checks', () => {
  const report = summarize([
    { name: 'threshold.deliverySuccessPct', ok: false, severity: 'error', detail: 'value=90, minimum>=95' },
  ], { reportPath: 'x', metrics: {} });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
});
