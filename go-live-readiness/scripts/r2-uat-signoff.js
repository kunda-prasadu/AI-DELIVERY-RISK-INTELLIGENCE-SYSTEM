#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function nowStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function runNodeScript(args, cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  return {
    ok: result.status === 0,
    status: result.status,
    stdout,
    stderr,
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildSignoffReport(checkResult, liveResult, smokeResult) {
  const checkJson = safeJsonParse(checkResult.stdout);
  const liveJson = safeJsonParse(liveResult.stdout);
  const smokeJson = safeJsonParse(smokeResult.stdout);

  const staticPass = Boolean(checkResult.ok && checkJson && checkJson.status === 'pass');
  const livePass = Boolean(liveResult.ok && liveJson && liveJson.status === 'pass');
  const smokePass = Boolean(smokeResult.ok && smokeJson && Array.isArray(smokeJson.results));

  const status = staticPass && livePass && smokePass ? 'GO' : 'NO_GO';

  return {
    status,
    checks: {
      static: {
        pass: staticPass,
        summary: checkJson ? checkJson.summary : null,
      },
      live: {
        pass: livePass,
        summary: liveJson ? liveJson.summary : null,
      },
      smoke: {
        pass: smokePass,
        gatewayBaseUrl: smokeJson ? smokeJson.gatewayBaseUrl : null,
        probes: smokeJson ? smokeJson.results?.length || 0 : 0,
      },
    },
    raw: {
      static: checkJson,
      live: liveJson,
      smoke: smokeJson,
    },
  };
}

function renderSignoffMarkdown(report, generatedAt) {
  return [
    '# R2 UAT Sign-off Report',
    '',
    `Generated at: ${generatedAt}`,
    `Decision: **${report.status}**`,
    '',
    '## Gate Summary',
    '',
    `- Static readiness gate: ${report.checks.static.pass ? 'PASS' : 'FAIL'}`,
    `- Live readiness gate: ${report.checks.live.pass ? 'PASS' : 'FAIL'}`,
    `- Smoke gate: ${report.checks.smoke.pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Evidence',
    '',
    `- Static checks: ${report.checks.static.summary ? report.checks.static.summary.checksRun : 0} checks, ${report.checks.static.summary ? report.checks.static.summary.failures : 'n/a'} failures`,
    `- Live checks: ${report.checks.live.summary ? report.checks.live.summary.checksRun : 0} checks, ${report.checks.live.summary ? report.checks.live.summary.failures : 'n/a'} failures`,
    `- Smoke probes: ${report.checks.smoke.probes}`,
    '',
    '## Raw JSON Snapshot',
    '',
    '```json',
    JSON.stringify(report, null, 2),
    '```',
    '',
  ].join('\n');
}

function writeReportFiles(rootDir, report, generatedAt) {
  const reportsDir = path.join(rootDir, 'go-live-readiness', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const stamp = nowStamp(new Date(generatedAt));
  const reportFile = path.join(reportsDir, `r2-uat-signoff-${stamp}.md`);
  const latestFile = path.join(reportsDir, 'latest-r2-uat-signoff.md');

  const markdown = renderSignoffMarkdown(report, generatedAt);
  fs.writeFileSync(reportFile, markdown, 'utf8');
  fs.writeFileSync(latestFile, markdown, 'utf8');

  return { reportFile, latestFile };
}

async function main() {
  const rootDir = path.resolve(__dirname, '..', '..');
  const glrDir = path.join(rootDir, 'go-live-readiness');

  const staticResult = runNodeScript(['scripts/readiness-check.js', '--json'], glrDir);
  const liveResult = runNodeScript(['scripts/readiness-check.js', '--live', '--json'], glrDir);
  const smokeResult = runNodeScript(['scripts/smoke-check.js'], glrDir);

  const report = buildSignoffReport(staticResult, liveResult, smokeResult);
  const generatedAt = new Date().toISOString();
  const files = writeReportFiles(rootDir, report, generatedAt);

  console.log(`R2 UAT Decision: ${report.status}`);
  console.log(`Report: ${files.reportFile}`);

  if (report.status !== 'GO') {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  nowStamp,
  safeJsonParse,
  buildSignoffReport,
  renderSignoffMarkdown,
  writeReportFiles,
};
