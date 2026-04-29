# Incident Response Runbook

## Trigger

Use this runbook for production-impacting events during or after go-live.

## First 5 Minutes

- Declare severity and assign incident commander.
- Freeze further deploy changes.
- Capture current symptoms: affected routes, user roles, and error samples.
- Check `api-gateway-service` health and recent 5xx behavior.
- Check `observability-service` `/health/ready` and `/metrics/summary`.

## Triage Flow

### Authentication failures
- Verify `JWT_SECRET` alignment across services.
- Verify `identity-service` `/health` and recent login errors.
- Confirm token issuance and gateway auth pass-through.

### Project API failures
- Verify `project-service` `/health`.
- Test `/api/projects` and `/api/projects/proj-001/risk-score` through the gateway.
- Inspect permission claims in a fresh access token.

### Metrics issues
- Verify `metrics-normalization-service` `/health/ready`.
- Check event ingestion endpoint and latest summary timestamp.
- Confirm gateway routing to `/api/metrics/*`.

### Observability blind spot
- Verify `observability-service` process is healthy.
- Confirm `/metrics` still exports data.
- Fall back to service-level logs if central health is impaired.

## Communication

- Update stakeholders every 15 minutes until stable.
- Record timeline, mitigations, and owner actions.
- Announce rollback decision explicitly if triggered.

## Resolution Exit

- User-facing path restored.
- Alerts return below threshold.
- Post-incident notes captured for retrospective.
