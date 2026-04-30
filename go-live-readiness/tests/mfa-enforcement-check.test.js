'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  evaluateGate,
  loadGateConfig,
  parsePassFlag,
  repoRootFrom,
  summarize,
} = require('../scripts/mfa-enforcement-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadGateConfig returns expected required flags', () => {
  const config = loadGateConfig(rootDir);
  assert.equal(config.requiredPassFlags.length, 4);
});

test('parsePassFlag reads PASS/FAIL values', () => {
  const markdown = '- Privileged Login Requires MFA: PASS\n';
  assert.equal(parsePassFlag(markdown, 'Privileged Login Requires MFA:'), true);
});

test('evaluateGate passes for current mfa evidence', () => {
  const report = evaluateGate(rootDir, loadGateConfig(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize returns fail on error checks', () => {
  const report = summarize([
    { name: 'flag.PrivilegedLoginRequiresMFA', ok: false, severity: 'error', detail: 'value=FAIL' },
  ], { reportPath: 'x' });

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
});
