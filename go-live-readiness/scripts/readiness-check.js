#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function repoRootFrom(scriptDir = __dirname) {
  return path.resolve(scriptDir, '..', '..');
}

function loadCatalog(rootDir) {
  const catalogPath = path.join(rootDir, 'go-live-readiness', 'config', 'services.json');
  return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
}

function runStaticChecks(rootDir, catalog) {
  const services = catalog.map((service) => {
    const serviceDir = path.join(rootDir, service.path);
    const packageJsonPath = path.join(serviceDir, 'package.json');
    const envExamplePath = path.join(serviceDir, '.env.example');

    const checks = [];
    const packageJson = safeReadJson(packageJsonPath);

    checks.push({
      name: 'directory',
      ok: fs.existsSync(serviceDir),
      severity: 'error',
      detail: serviceDir,
    });

    checks.push({
      name: 'package.json',
      ok: fs.existsSync(packageJsonPath) && Boolean(packageJson),
      severity: 'error',
      detail: packageJsonPath,
    });

    for (const scriptName of service.requiredScripts || []) {
      checks.push({
        name: `script:${scriptName}`,
        ok: Boolean(packageJson && packageJson.scripts && packageJson.scripts[scriptName]),
        severity: 'error',
        detail: packageJson && packageJson.scripts ? packageJson.scripts[scriptName] || null : null,
      });
    }

    if (service.requiresEnvExample) {
      checks.push({
        name: '.env.example',
        ok: fs.existsSync(envExamplePath),
        severity: 'warning',
        detail: envExamplePath,
      });
    }

    return {
      id: service.id,
      type: service.type,
      path: service.path,
      checks,
    };
  });

  return summarize(services, 'static');
}

async function pingHealth(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      url,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      url,
      error: error.name === 'AbortError' ? 'timeout' : error.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runLiveChecks(catalog) {
  const services = [];

  for (const service of catalog) {
    if (!service.recommendedHealthUrl) {
      services.push({
        id: service.id,
        type: service.type,
        path: service.path,
        checks: [
          {
            name: 'health',
            ok: true,
            skipped: true,
            severity: 'info',
            detail: 'No live health endpoint configured',
          },
        ],
      });
      continue;
    }

    const result = await pingHealth(service.recommendedHealthUrl);
    services.push({
      id: service.id,
      type: service.type,
      path: service.path,
      checks: [
        {
          name: 'health',
          ok: result.ok,
          severity: 'error',
          detail: result.ok
            ? `${result.url} -> ${result.status}`
            : `${result.url} -> ${result.status || 'unreachable'}${result.error ? ` (${result.error})` : ''}`,
        },
      ],
    });
  }

  return summarize(services, 'live');
}

function summarize(services, mode) {
  const allChecks = services.flatMap((service) => service.checks);
  const failures = allChecks.filter((check) => !check.ok && check.severity === 'error').length;
  const warnings = allChecks.filter((check) => !check.ok && check.severity === 'warning').length;
  const skipped = allChecks.filter((check) => check.skipped).length;

  return {
    mode,
    status: failures === 0 ? 'pass' : 'fail',
    services,
    summary: {
      servicesChecked: services.length,
      checksRun: allChecks.length,
      failures,
      warnings,
      skipped,
    },
  };
}

function printReport(report) {
  console.log(`Mode: ${report.mode}`);
  console.log(`Status: ${report.status.toUpperCase()}`);
  console.log(`Checks: ${report.summary.checksRun} | Failures: ${report.summary.failures} | Warnings: ${report.summary.warnings} | Skipped: ${report.summary.skipped}`);
  console.log('');

  for (const service of report.services) {
    console.log(`${service.id} (${service.type})`);
    for (const check of service.checks) {
      const state = check.skipped ? 'SKIP' : check.ok ? 'PASS' : check.severity === 'warning' ? 'WARN' : 'FAIL';
      console.log(`  - ${state} ${check.name}: ${check.detail || ''}`.trimEnd());
    }
  }
}

async function main(argv = process.argv.slice(2)) {
  const rootDir = repoRootFrom();
  const catalog = loadCatalog(rootDir);
  const live = argv.includes('--live');
  const json = argv.includes('--json');

  const report = live ? await runLiveChecks(catalog) : runStaticChecks(rootDir, catalog);

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
  loadCatalog,
  repoRootFrom,
  runStaticChecks,
  runLiveChecks,
  summarize,
};
