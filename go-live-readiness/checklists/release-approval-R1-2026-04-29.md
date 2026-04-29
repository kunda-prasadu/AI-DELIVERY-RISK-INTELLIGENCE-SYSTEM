# Release Approval: R1 (2026-04-29)

## Release Metadata

- Release ID: R1
- Date: 2026-04-29
- Target Environment: local-only production-like baseline
- Commit / Tag: main HEAD / R1-local-only-final-2026-04-29
- Change Window: 2026-04-29 local validation window
- Release Manager: kunda-prasadu
- Incident Commander: kunda-prasadu
- Rollback Operator: kunda-prasadu

## Scope

- Included services: identity-service, project-service, observability-service, metrics-normalization-service, api-gateway-service, dashboard-shell
- Excluded services: none
- Known risks: no cloud deployment in scope for this baseline
- Customer-facing impact: local-only release baseline and operational gate hardening

## Required Evidence

- Static readiness check output (`go-live-readiness` `npm run check`): PASS (captured in rehearsal report)
- Live readiness check output (`go-live-readiness` `npm run check:live`): PASS (captured in rehearsal report)
- Smoke check output (`go-live-readiness` `npm run smoke`): PASS (captured in rehearsal report)
- Release rehearsal report (`go-live-readiness/reports/release-rehearsal-*.md`): [ai-delivery-risk/go-live-readiness/reports/release-rehearsal-20260429-225748.md](../reports/release-rehearsal-20260429-225748.md)
- Release automation output (`release-test-automation` `npm test`): PASS (captured in rehearsal report)
- Observability dashboard snapshot: local health endpoints validated in rehearsal
- Alerting verification notes: no active alert thresholds breached during local rehearsal

## Technical Gate Checklist

- [x] Startup order confirmed.
- [x] `JWT_SECRET` aligned across identity, project, and gateway (required config documented).
- [x] Gateway upstream configuration validated (`/auth`, `/projects`, `/metrics`).
- [x] No blocking Sev-1/Sev-2 issues open in local rehearsal context.
- [x] Rollback path validated and owner role defined.
- [x] Incident communication process documented.

## Go / No-Go Criteria

### GO only if all are true

- [x] `npm run check` passed (local rehearsal)
- [x] `npm run check:live` passed (local rehearsal)
- [x] `npm run smoke` passed (local rehearsal)
- [x] `release-test-automation` passed (local rehearsal)
- [x] Local-only release checklist blockers closed

### NO-GO triggers

- [ ] Any failed release gate command in target environment
- [ ] Unresolved high-risk dependency outage
- [ ] Missing rollback owner or untested rollback path

## Approval Sign-Off

- Engineering Lead: kunda-prasadu Date/Time: 2026-04-29T22:58Z
- Platform Lead: kunda-prasadu Date/Time: 2026-04-29T22:58Z
- QA Lead: kunda-prasadu Date/Time: 2026-04-29T22:58Z
- Product Owner: kunda-prasadu Date/Time: 2026-04-29T22:58Z

## Final Decision

- Decision: GO (local-only baseline)
- Decision Timestamp: 2026-04-29T22:58Z
- Notes: Cloud deployment intentionally out of scope; validated local-only release gate and rehearsal.

## Post-Release Verification

- [x] `check:live` re-run succeeded after deployment
- [x] `smoke` re-run succeeded after deployment
- [ ] 30-minute stability window passed
- [ ] No sustained alert threshold breaches
- [x] Stakeholder confirmation posted

Notes:
- 2026-04-29T17:34Z: Resolved false-negative container health by exempting `identity-service` `/health` endpoint from global request rate limiting.
- 2026-04-29T17:34Z onward: identity container reports `healthy`; begin fresh 30-minute stability observation from this timestamp.
