'use strict';

const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  repoRootFrom,
  loadCatalog,
  runStaticChecks,
  summarize,
} = require('../scripts/readiness-check');

const rootDir = path.resolve(__dirname, '..', '..');

test('repoRootFrom resolves ai-delivery-risk root', () => {
  const resolved = repoRootFrom(path.join(rootDir, 'go-live-readiness', 'scripts'));
  assert.equal(resolved, rootDir);
});

test('loadCatalog returns all tracked services', () => {
  const catalog = loadCatalog(rootDir);
  assert.equal(Array.isArray(catalog), true);
  assert.equal(catalog.length >= 8, true);
  assert.equal(catalog.some((entry) => entry.id === 'api-gateway-service'), true);
});

test('runStaticChecks passes for current repository state', () => {
  const report = runStaticChecks(rootDir, loadCatalog(rootDir));
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.failures, 0);
});

test('summarize marks report as fail when error checks fail', () => {
  const report = summarize([
    {
      id: 'dummy',
      checks: [
        { name: 'directory', ok: false, severity: 'error', detail: 'missing' },
        { name: '.env.example', ok: false, severity: 'warning', detail: 'missing' },
      ],
    },
  ], 'static');

  assert.equal(report.status, 'fail');
  assert.equal(report.summary.failures, 1);
  assert.equal(report.summary.warnings, 1);
});
