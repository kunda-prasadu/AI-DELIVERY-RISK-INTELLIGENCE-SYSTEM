'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  includesAll,
  loadControls,
  repoRootFrom,
  runComplianceChecks,
  summarize,
} = require('../scripts/compliance-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadControls returns configured compliance controls', () => {
  const controls = loadControls(rootDir);
  assert.equal(Array.isArray(controls), true);
  assert.equal(controls.length >= 4, true);
  assert.equal(controls.some((entry) => entry.id === 'SOC2-CC6'), true);
  assert.equal(controls.some((entry) => entry.id === 'GDPR-ART32'), true);
});

test('includesAll reports missing markers correctly', () => {
  const check = includesAll('alpha beta', ['alpha', 'gamma']);
  assert.equal(check.ok, false);
  assert.deepEqual(check.missing, ['gamma']);
});

test('runComplianceChecks passes for current repository state', () => {
  const report = runComplianceChecks(rootDir, loadControls(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize marks report fail when any error check fails', () => {
  const report = summarize([
    {
      id: 'SOC2-CC6',
      checks: [
        { name: 'policy.file', ok: false, severity: 'error', detail: 'missing policy' },
      ],
    },
  ]);

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
});
