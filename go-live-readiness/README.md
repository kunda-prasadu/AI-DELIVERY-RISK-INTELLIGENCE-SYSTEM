# E-110 Go-Live Readiness Kit

This package provides release-readiness artifacts for the AI Delivery Risk Intelligence stack.

## Included

- Static readiness verifier for repository prerequisites
- Optional live endpoint verifier for deployed or locally running services
- Production release checklist
- Release approval template
- Monitoring and alert matrix
- Incident response runbook
- Rollback playbook

## Commands

```bash
npm run check
npm run check:live
npm run smoke
npm run uat:signoff
npm test
```

Default workflow is local-first and does not require any cloud account.

For staging/production, set remote endpoint variables (see `.env.remote.example`) and run:

```bash
GATEWAY_BASE_URL=https://staging.example.com npm run smoke
```

Profile examples are available in `profiles/`:

- `profiles/staging.env.example`
- `profiles/production.env.example`

For quick local profile validation using `profiles/staging.env`, run:

```bash
npm run check:live
npm run smoke
```

You can run profile-based remote validation from repo root:

```bash
./scripts/validate-release-profile.sh staging
```

And for a full remote release validation from repository root:

```bash
GATEWAY_BASE_URL=https://staging.example.com ./scripts/validate-release-remote.sh
```

From repository root, you can also run a full release rehearsal:

```bash
./scripts/validate-release.sh
```

This generates a timestamped report under `go-live-readiness/reports/`.

For R2 UAT final sign-off evidence generation, run:

```bash
npm run uat:signoff
```

This command runs static + live + smoke checks and writes `go-live-readiness/reports/latest-r2-uat-signoff.md`.

For manually curated deployment evidence, update:

- `go-live-readiness/reports/latest-readiness-evidence.md`

Use the release approval template at [go-live-readiness/checklists/release-approval-template.md](checklists/release-approval-template.md) to capture sign-offs and evidence before final GO decision.

Current pre-filled record for this cycle: [go-live-readiness/checklists/release-approval-R1-2026-04-29.md](checklists/release-approval-R1-2026-04-29.md)

## Startup Order

1. `identity-service`
2. `project-service`
3. `observability-service`
4. `metrics-normalization-service`
5. `api-gateway-service`
6. `dashboard-shell`

## Health Endpoints

- `identity-service`: `/health`
- `project-service`: `/health`
- `observability-service`: `/health/live`, `/health/ready`, `/metrics`, `/metrics/summary`
- `metrics-normalization-service`: `/health/live`, `/health/ready`
- `api-gateway-service`: `/health`

## Release Gate

Release is go for production only when all of the following are true:

- `npm run check` passes
- `release-test-automation` passes
- `npm run check:live` passes in the target environment
- `npm run smoke` passes against the target gateway
- All blockers in [checklists/release-checklist.md](checklists/release-checklist.md) are signed off
- Rollback owner and incident commander are assigned
