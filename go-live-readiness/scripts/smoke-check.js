#!/usr/bin/env node
'use strict';

const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || 'http://127.0.0.1:3005';
const smokeEmail = `smoke_${Date.now()}@example.com`;

async function call(name, path, options = {}) {
  const response = await fetch(`${gatewayBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    name,
    status: response.status,
    body,
  };
}

async function runSmokeCheck() {
  const register = await call('register', '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: smokeEmail,
      password: 'Admin@1234!',
      name: 'Smoke Admin',
      role: 'admin',
    }),
  });

  if (register.status !== 201 || !register.body?.accessToken) {
    throw new Error(`register failed: ${JSON.stringify(register)}`);
  }

  const authHeaders = {
    Authorization: `Bearer ${register.body.accessToken}`,
  };

  const results = [
    register,
    await call('projects', '/api/projects', { headers: authHeaders }),
    await call('risk', '/api/projects/proj-001/risk-score', { headers: authHeaders }),
    await call('metricsIngest', '/api/metrics/events', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        events: [
          {
            source: 'github',
            eventType: 'commit',
            projectId: 'proj-001',
            timestamp: new Date().toISOString(),
            severity: 'low',
          },
          {
            source: 'qa',
            eventType: 'test_failure',
            projectId: 'proj-001',
            timestamp: new Date().toISOString(),
            severity: 'high',
          },
        ],
      }),
    }),
    await call('metricsSummary', '/api/metrics/summary', { headers: authHeaders }),
    await call('observability', '/api/observability/health/live'),
  ];

  for (const result of results) {
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`${result.name} failed: ${JSON.stringify(result)}`);
    }
  }

  const metricsIngest = results.find((result) => result.name === 'metricsIngest');
  const metricsSummary = results.find((result) => result.name === 'metricsSummary');

  if (metricsIngest.body?.accepted !== 2) {
    throw new Error(`metricsIngest unexpected payload: ${JSON.stringify(metricsIngest)}`);
  }

  if ((metricsSummary.body?.totalEvents || 0) < 2) {
    throw new Error(`metricsSummary unexpected payload: ${JSON.stringify(metricsSummary)}`);
  }

  return {
    gatewayBaseUrl,
    results,
  };
}

if (require.main === module) {
  runSmokeCheck()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exit(1);
    });
}

module.exports = {
  runSmokeCheck,
};
