# Release Checklist

## T-7 Days

- Confirm production environment variables are defined for all backend services.
- Confirm `JWT_SECRET` is identical for `identity-service`, `project-service`, and `api-gateway-service`.
- Confirm named owners for release manager, incident commander, and rollback operator.
- Run `release-test-automation` full suite and archive the output.
- Verify Angular production build completes successfully in `dashboard-shell`.

## T-1 Day

- Run `npm run check` in `go-live-readiness`.
- Run `npm run check:compliance` in `go-live-readiness`.
- Run `npm run check:defects` in `go-live-readiness`.
- Run `npm run check:hypercare` in `go-live-readiness`.
- Run `npm run check:live` against staging with all services running.
- Run `npm run smoke` against the gateway in the target environment.
- Validate `observability-service` readiness and metrics export.
- Confirm alert receivers and escalation paths in [monitoring/alert-matrix.md](../monitoring/alert-matrix.md).
- Confirm deployment window, communication channel, and stakeholder approvals.

## T-0 Release Window

- Deploy in startup order documented in [README.md](../README.md).
- Verify each service health endpoint before proceeding to the next service.
- Run `npm run smoke` and confirm login, project list, risk score, metrics summary, and observability live probe through `api-gateway-service`.
- Capture deployment start/end timestamps and any manual interventions.
- Keep rollback operator on standby until the stability window closes.

## T+30 Minutes

- Check error rates, latency, and readiness on `observability-service`.
- Confirm no sustained 5xx responses from `api-gateway-service`.
- Confirm risk dashboard renders successfully for at least one admin user.
- Review background metrics ingestion and project risk endpoint responses.

## Exit Criteria

- All health endpoints are green.
- Compliance policy and evidence checks pass.
- Defect burn-down gate confirms no open critical defects.
- Hypercare SLA gate confirms 2-week window and SLA adherence.
- No Sev-1 or Sev-2 incidents open.
- Smoke test paths succeed end-to-end.
- Stakeholders acknowledge production availability.
