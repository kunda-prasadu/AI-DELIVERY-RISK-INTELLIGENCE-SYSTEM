# AI Delivery Risk Intelligence

Multi-service delivery risk platform with backend APIs, Angular dashboard, observability, gateway routing, release automation, and go-live readiness tooling.

## Services

| Component | Path | Default Port | Purpose |
|---|---|---:|---|
| Connector Framework | `connector-framework` | n/a | Ingests and normalizes Jira, GitHub, QA, and CI/CD events |
| Identity Service | `identity-service` | 3001 | JWT auth, refresh tokens, RBAC |
| Project Service | `project-service` | 3002 | Project directory, risk score, insights, event ingest |
| Observability Service | `observability-service` | 3003 | Health, readiness, metrics, request tracing |
| Metrics Normalization Service | `metrics-normalization-service` | 3004 | Metrics aggregation and trend analysis |
| API Gateway Service | `api-gateway-service` | 3005 | Routed entrypoint, auth enforcement, rate limiting |
| Dashboard Shell | `dashboard-shell` | Angular dev server | Frontend dashboard |
| Release Test Automation | `release-test-automation` | n/a | Integration, contract, and baseline load tests |
| Go-Live Readiness | `go-live-readiness` | n/a | Readiness checks, smoke tests, runbooks |

## Startup Order

Start services in this order:

1. `identity-service`
2. `project-service`
3. `observability-service`
4. `metrics-normalization-service`
5. `api-gateway-service`
6. `dashboard-shell`

## Local Start Commands

Run each from the repository root in a separate terminal:

```bash
cd identity-service && npm start
cd project-service && npm start
cd observability-service && npm start
cd metrics-normalization-service && npm start
cd api-gateway-service && npm start
cd dashboard-shell && npm start
```

Or start the backend stack in one command:

```bash
./scripts/start-local-backend-stack.sh
```

Stop it cleanly with:

```bash
./scripts/stop-local-backend-stack.sh
```

Run a full one-command release rehearsal (start, validate, smoke, stop, report):

```bash
./scripts/validate-release.sh
```

Run the stack in Docker Compose for a production-like local deployment:

```bash
./scripts/start-compose-stack.sh
```

Run only the backend services in Docker Compose:

```bash
./scripts/start-compose-backend-stack.sh
```

Launch the local demo and open the local URLs automatically:

```bash
./scripts/run-local-demo.sh
```

Stop the Compose stack:

```bash
./scripts/stop-compose-stack.sh
```

Run Compose-based live validation and smoke checks:

```bash
./scripts/validate-compose-stack.sh
```

Run remote/staging validation (no local service startup) with:

```bash
GATEWAY_BASE_URL=https://staging.example.com ./scripts/validate-release-remote.sh
```

Profile-based remote validation (recommended):

```bash
# one-time setup
cp go-live-readiness/profiles/staging.env.example go-live-readiness/profiles/staging.env

# run
./scripts/validate-release-profile.sh staging
```

For remote health endpoint overrides used by `check:live`, see [go-live-readiness/.env.remote.example](go-live-readiness/.env.remote.example).

## Core Health Endpoints

- Identity: `http://127.0.0.1:3001/health`
- Project: `http://127.0.0.1:3002/health`
- Observability live: `http://127.0.0.1:3003/health/live`
- Observability ready: `http://127.0.0.1:3003/health/ready`
- Metrics live: `http://127.0.0.1:3004/health/live`
- Metrics ready: `http://127.0.0.1:3004/health/ready`
- Gateway: `http://127.0.0.1:3005/health`

## Verification Commands

### Service-Level Tests

```bash
cd identity-service && npm test
cd project-service && npm test
cd observability-service && npm test
cd metrics-normalization-service && npm test
cd api-gateway-service && npm test
cd release-test-automation && npm test
cd go-live-readiness && npm test
```

### Release Checks

```bash
cd go-live-readiness && npm run check
cd go-live-readiness && npm run check:live
cd go-live-readiness && npm run smoke
```

Or run the full release rehearsal pipeline from root:

```bash
./scripts/validate-release.sh
```

### Automation Pack

```bash
cd release-test-automation && npm test
cd release-test-automation && npm run test:integration
cd release-test-automation && npm run test:contract
cd release-test-automation && npm run test:baseline
```

## Important Config Notes

- `JWT_SECRET` must match across `identity-service`, `project-service`, and `api-gateway-service`.
- Gateway upstream defaults assume downstream route bases:
  - identity -> `/auth`
  - project -> `/projects`
  - metrics -> `/metrics`
- Use each service `.env.example` as the starting point for environment setup.

## Detailed Docs

- Observability details: [ai-delivery-risk/observability-service/README.md](observability-service/README.md)
- Release automation: [ai-delivery-risk/release-test-automation/README.md](release-test-automation/README.md)
- Go-live readiness: [ai-delivery-risk/go-live-readiness/README.md](go-live-readiness/README.md)
- Local demo runbook: [ai-delivery-risk/go-live-readiness/runbooks/local-demo.md](go-live-readiness/runbooks/local-demo.md)
- Render deployment runbook: [ai-delivery-risk/go-live-readiness/runbooks/render-deployment.md](go-live-readiness/runbooks/render-deployment.md)
- Release checklist: [ai-delivery-risk/go-live-readiness/checklists/release-checklist.md](go-live-readiness/checklists/release-checklist.md)
- Release approval template: [ai-delivery-risk/go-live-readiness/checklists/release-approval-template.md](go-live-readiness/checklists/release-approval-template.md)
- Incident response: [ai-delivery-risk/go-live-readiness/runbooks/incident-response.md](go-live-readiness/runbooks/incident-response.md)
- Rollback playbook: [ai-delivery-risk/go-live-readiness/runbooks/rollback-playbook.md](go-live-readiness/runbooks/rollback-playbook.md)

For future cloud deployment preparation, see [ai-delivery-risk/render.yaml](render.yaml) and [ai-delivery-risk/go-live-readiness/runbooks/render-deployment.md](go-live-readiness/runbooks/render-deployment.md).

## Current Workspace State

The background backend services that were started for local validation have been stopped cleanly. Re-run the startup sequence above before using `npm run check:live` or `npm run smoke` again.

The recommended shortcut is to use [ai-delivery-risk/scripts/start-local-backend-stack.sh](scripts/start-local-backend-stack.sh) and [ai-delivery-risk/scripts/stop-local-backend-stack.sh](scripts/stop-local-backend-stack.sh).

For a containerized local deployment, use [ai-delivery-risk/docker-compose.yml](docker-compose.yml) with [ai-delivery-risk/scripts/start-compose-stack.sh](scripts/start-compose-stack.sh) and [ai-delivery-risk/scripts/stop-compose-stack.sh](scripts/stop-compose-stack.sh). The dashboard is served at `http://127.0.0.1:4200`, and its `/api/*` requests are proxied to the local gateway.

If you only need the APIs and readiness tooling, use [ai-delivery-risk/scripts/start-compose-backend-stack.sh](scripts/start-compose-backend-stack.sh). The Compose file now includes native healthchecks so downstream services wait for upstream readiness before starting.
