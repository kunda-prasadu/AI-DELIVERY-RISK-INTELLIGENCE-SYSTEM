# Rollback Playbook

## Rollback Triggers

- Sustained Sev-1 user-facing outage
- Gateway 5xx rate remains above threshold after mitigation
- Auth or token validation broken across services
- Dashboard unusable for primary release personas

## Rollback Order

1. `dashboard-shell`
2. `api-gateway-service`
3. `metrics-normalization-service`
4. `observability-service` only if the release changed it and it is the cause
5. `project-service`
6. `identity-service`

Rollback backend services in reverse dependency order to reduce blast radius.

## Procedure

- Halt all forward deploys.
- Restore the last known-good artifact/image for each affected service.
- Re-apply the previous stable environment configuration if config changed.
- Verify health endpoint success after each rollback step.
- Re-run smoke flow through `api-gateway-service`.

## Post-Rollback Validation

- `api-gateway-service` `/health` is 200.
- Login succeeds and returns a usable access token.
- `/api/projects` and `/api/projects/proj-001/risk-score` succeed.
- `/api/metrics/summary` and `/api/observability/health/live` succeed.

## Evidence To Capture

- Rolled back version identifiers
- Start/end timestamps
- Impact duration
- Root-cause hypothesis
- Follow-up actions before next release attempt
