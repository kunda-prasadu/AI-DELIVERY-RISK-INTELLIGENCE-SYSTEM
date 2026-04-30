#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const EVIDENCE_FILE = path.join('go-live-readiness', 'reports', 'latest-compliance-evidence.md');
const CATALOG_FILE = path.join('go-live-readiness', 'config', 'compliance-controls.json');

function repoRootFrom(scriptDir = __dirname) {
  return path.resolve(scriptDir, '..', '..');
}

function loadControls(rootDir) {
  const filePath = path.join(rootDir, CATALOG_FILE);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    return null;
  }
}

function includesAll(content, markers = []) {
  if (typeof content !== 'string') {
    return {
      ok: false,
      missing: [...markers],
    };
  }

  const missing = markers.filter((marker) => !content.includes(marker));
  return {
    ok: missing.length === 0,
    missing,
  };
}

function runComplianceChecks(rootDir, controls) {
  const evidencePath = path.join(rootDir, EVIDENCE_FILE);
  const evidenceContent = safeRead(evidencePath);

  const checks = controls.map((control) => {
    const policyPath = path.join(rootDir, control.policyFile);
    const policyContent = safeRead(policyPath);

    const policyMarkers = includesAll(policyContent, control.policyMarkers || []);
    const evidenceMarkers = includesAll(evidenceContent, control.evidenceMarkers || []);

    return {
      id: control.id,
      framework: control.framework,
      name: control.name,
      checks: [
        {
          name: 'policy.file',
          ok: Boolean(policyContent),
          severity: 'error',
          detail: policyPath,
        },
        {
          name: 'policy.markers',
          ok: policyMarkers.ok,
          severity: 'error',
          detail: policyMarkers.ok ? 'All required policy markers present' : `Missing: ${policyMarkers.missing.join(', ')}`,
        },
        {
          name: 'evidence.file',
          ok: Boolean(evidenceContent),
          severity: 'error',
          detail: evidencePath,
        },
        {
          name: 'evidence.markers',
          ok: evidenceMarkers.ok,
          severity: 'error',
          detail: evidenceMarkers.ok ? 'All required evidence markers present' : `Missing: ${evidenceMarkers.missing.join(', ')}`,
        },
      ],
    };
  });

  return summarize(checks);
}

function summarize(controls) {
  const allChecks = controls.flatMap((control) => control.checks);
  const failures = allChecks.filter((check) => !check.ok && check.severity === 'error').length;

  return {
    status: failures === 0 ? 'pass' : 'fail',
    controls,
    summary: {
      controlsChecked: controls.length,
      checksRun: allChecks.length,
      failures,
    },
  };
}

function printReport(report) {
  console.log(`Status: ${report.status.toUpperCase()}`);
  console.log(`Controls: ${report.summary.controlsChecked} | Checks: ${report.summary.checksRun} | Failures: ${report.summary.failures}`);
  console.log('');

  for (const control of report.controls) {
    console.log(`${control.id} (${control.framework}) ${control.name}`);

    for (const check of control.checks) {
      const state = check.ok ? 'PASS' : 'FAIL';
      console.log(`  - ${state} ${check.name}: ${check.detail}`);
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const rootDir = repoRootFrom();
  const controls = loadControls(rootDir);
  const json = argv.includes('--json');
  const report = runComplianceChecks(rootDir, controls);

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
  includesAll,
  loadControls,
  repoRootFrom,
  runComplianceChecks,
  summarize,
};
