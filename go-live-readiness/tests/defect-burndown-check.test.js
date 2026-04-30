'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  evaluateGate,
  loadGateConfig,
  parseCount,
  repoRootFrom,
  summarize,
} = require('../scripts/defect-burndown-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadGateConfig returns threshold configuration', () => {
  const config = loadGateConfig(rootDir);
  assert.equal(config.thresholds.critical, 0);
  assert.equal(config.thresholds.blocker, 0);
  assert.equal(Array.isArray(config.requiredMarkers), true);
});

test('parseCount extracts numeric metric values', () => {
  const markdown = '- Open Critical Defects: 2\n- Open Blocker Defects: 1\n';
  assert.equal(parseCount(markdown, 'Open Critical Defects:'), 2);
  assert.equal(parseCount(markdown, 'Open Blocker Defects:'), 1);
});

test('evaluateGate passes for current defect evidence', () => {
  const report = evaluateGate(rootDir, loadGateConfig(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize returns fail when check errors exist', () => {
  const report = summarize([
    { name: 'threshold.critical', ok: false, severity: 'error', detail: 'value=1, threshold<=0' },
  ], { reportPath: 'x', counts: {} });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
});
