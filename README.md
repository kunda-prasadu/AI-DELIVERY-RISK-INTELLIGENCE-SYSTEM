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
- Release checklist: [ai-delivery-risk/go-live-readiness/checklists/release-checklist.md](go-live-readiness/checklists/release-checklist.md)
- Release approval template: [ai-delivery-risk/go-live-readiness/checklists/release-approval-template.md](go-live-readiness/checklists/release-approval-template.md)
- Incident response: [ai-delivery-risk/go-live-readiness/runbooks/incident-response.md](go-live-readiness/runbooks/incident-response.md)
- Rollback playbook: [ai-delivery-risk/go-live-readiness/runbooks/rollback-playbook.md](go-live-readiness/runbooks/rollback-playbook.md)

## Current Workspace State

The background backend services that were started for local validation have been stopped cleanly. Re-run the startup sequence above before using `npm run check:live` or `npm run smoke` again.

The recommended shortcut is to use [ai-delivery-risk/scripts/start-local-backend-stack.sh](scripts/start-local-backend-stack.sh) and [ai-delivery-risk/scripts/stop-local-backend-stack.sh](scripts/stop-local-backend-stack.sh).
