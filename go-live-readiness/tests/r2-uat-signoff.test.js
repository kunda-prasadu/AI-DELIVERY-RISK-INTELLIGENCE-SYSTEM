'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  nowStamp,
  safeJsonParse,
  buildSignoffReport,
  renderSignoffMarkdown,
} = require('../scripts/r2-uat-signoff');

test('nowStamp formats date as YYYYMMDD-HHMMSS', () => {
  const date = new Date('2026-04-30T08:40:00.000Z');
  const stamp = nowStamp(date);
  assert.match(stamp, /^20260430-\d{6}$/);
});

test('safeJsonParse returns object for valid json', () => {
  assert.deepEqual(safeJsonParse('{"ok":true}'), { ok: true });
});

test('safeJsonParse returns null for invalid json', () => {
  assert.equal(safeJsonParse('not json'), null);
});

test('buildSignoffReport returns GO when all checks pass', () => {
  const report = buildSignoffReport(
    { ok: true, stdout: JSON.stringify({ status: 'pass', summary: { checksRun: 8, failures: 0 } }) },
    { ok: true, stdout: JSON.stringify({ status: 'pass', summary: { checksRun: 5, failures: 0 } }) },
    { ok: true, stdout: JSON.stringify({ gatewayBaseUrl: 'http://localhost:3005', results: [{ name: 'projects' }] }) }
  );

  assert.equal(report.status, 'GO');
  assert.equal(report.checks.static.pass, true);
  assert.equal(report.checks.live.pass, true);
  assert.equal(report.checks.smoke.pass, true);
});

test('buildSignoffReport returns NO_GO when any gate fails', () => {
  const report = buildSignoffReport(
    { ok: true, stdout: JSON.stringify({ status: 'fail', summary: { checksRun: 8, failures: 1 } }) },
    { ok: true, stdout: JSON.stringify({ status: 'pass', summary: { checksRun: 5, failures: 0 } }) },
    { ok: true, stdout: JSON.stringify({ gatewayBaseUrl: 'http://localhost:3005', results: [{ name: 'projects' }] }) }
  );

  assert.equal(report.status, 'NO_GO');
  assert.equal(report.checks.static.pass, false);
});

test('renderSignoffMarkdown includes decision and evidence lines', () => {
  const markdown = renderSignoffMarkdown(
    {
      status: 'GO',
      checks: {
        static: { pass: true, summary: { checksRun: 8, failures: 0 } },
        live: { pass: true, summary: { checksRun: 5, failures: 0 } },
        smoke: { pass: true, probes: 6 },
      },
      raw: {},
    },
    '2026-04-30T08:40:00.000Z'
  );

  assert.ok(markdown.includes('Decision: **GO**'));
  assert.ok(markdown.includes('Static readiness gate: PASS'));
  assert.ok(markdown.includes('Smoke probes: 6'));
});
