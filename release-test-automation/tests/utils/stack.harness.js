'use strict';

const path = require('path');
const express = require('express');

function rootRequire(relativePath) {
  return require(path.join(__dirname, '..', '..', '..', relativePath));
}

async function startStack() {
  jest.resetModules();

  const ports = {
    identity: parseInt(process.env.TEST_IDENTITY_PORT || '4101', 10),
    project: parseInt(process.env.TEST_PROJECT_PORT || '4102', 10),
    observability: parseInt(process.env.TEST_OBSERVABILITY_PORT || '4103', 10),
    metrics: parseInt(process.env.TEST_METRICS_PORT || '4104', 10),
    gateway: parseInt(process.env.TEST_GATEWAY_PORT || '4105', 10),
  };

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars!!';
  process.env.IDENTITY_SERVICE_URL = `http://127.0.0.1:${ports.identity}/auth`;
  process.env.PROJECT_SERVICE_URL = `http://127.0.0.1:${ports.project}/projects`;
  process.env.OBSERVABILITY_SERVICE_URL = `http://127.0.0.1:${ports.observability}`;
  process.env.METRICS_SERVICE_URL = `http://127.0.0.1:${ports.metrics}/metrics`;
  process.env.PORT = `${ports.gateway}`;

  const authRoutes = rootRequire('identity-service/src/routes/auth.routes');
  const identityApp = express();
  identityApp.use(express.json());
  identityApp.use('/auth', authRoutes);
  identityApp.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  const projectApp = rootRequire('project-service/src/index');
  const observabilityApp = rootRequire('observability-service/src/index');
  const metricsApp = rootRequire('metrics-normalization-service/src/index');
  const gatewayApp = rootRequire('api-gateway-service/src/index');

  const servers = [];
  servers.push(identityApp.listen(ports.identity));
  servers.push(projectApp.listen(ports.project));
  servers.push(observabilityApp.listen(ports.observability));
  servers.push(metricsApp.listen(ports.metrics));
  servers.push(gatewayApp.listen(ports.gateway));

  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    ports,
    gatewayBaseUrl: `http://127.0.0.1:${ports.gateway}`,
    close: async () => {
      await Promise.all(
        servers.map((server) =>
          new Promise((resolve) => {
            server.close(() => resolve());
          })
        )
      );
    },
  };
}

module.exports = { startStack };
