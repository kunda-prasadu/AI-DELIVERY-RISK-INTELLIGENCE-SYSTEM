# Latest Readiness Evidence

- Timestamp: 2026-04-29T16:53:07Z
- Overall: PASS
- Environment: Local Compose (gateway at http://127.0.0.1:3005)

## Executed Commands

- `./scripts/start-compose-stack.sh`
- `npm run check:live`
- `npm run smoke`

## Live Readiness Result

- Mode: live
- Status: PASS
- Checks: 8
- Failures: 0
- Warnings: 0
- Skipped: 3

Health endpoint outcomes:
- PASS identity-service (`/health`)
- PASS project-service (`/health`)
- PASS observability-service (`/health/live`)
- PASS metrics-normalization-service (`/health/live`)
- PASS api-gateway-service (`/health`)
- SKIP connector-framework (no live health endpoint configured)
- SKIP dashboard-shell (no live health endpoint configured)
- SKIP release-test-automation (no live health endpoint configured)

## Smoke Result

- PASS register flow (201)
- PASS projects read flow (200)
- PASS risk score flow (200)
- PASS metrics ingest flow (200)
- PASS metrics summary flow (200)
- PASS observability flow (200)

## Notes

- Auth tokens from smoke output are intentionally excluded from this report.
- `release-remote-*.md` reports are gitignored; this file is the tracked acceptance artifact.

## CI Gate Evidence (Local-Only)

- Timestamp: 2026-04-29T17:22:41Z
- Commit SHA: `a46e22ba8fb00120a95404647ee102e9a970e838`
- Workflow: Release Gate
- Run URL: https://github.com/kunda-prasadu/AI-DELIVERY-RISK-INTELLIGENCE-SYSTEM/actions/runs/25123577394
- Overall: PASS

Job outcomes:
- PASS Frontend Tests
- PASS Readiness and Smoke Gate

Local-first policy confirmation:
- Cloud staging secret is removed.
- Release gate executes only local validation jobs.
