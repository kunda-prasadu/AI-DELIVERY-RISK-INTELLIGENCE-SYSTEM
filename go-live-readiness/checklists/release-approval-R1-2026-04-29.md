# Release Approval: R1 (2026-04-29)

## Release Metadata

- Release ID: R1
- Date: 2026-04-29
- Target Environment: local rehearsal completed; staging/prod pending
- Commit / Tag: TBD
- Change Window: TBD
- Release Manager: TBD
- Incident Commander: TBD
- Rollback Operator: TBD

## Scope

- Included services: identity-service, project-service, observability-service, metrics-normalization-service, api-gateway-service, dashboard-shell
- Excluded services: none
- Known risks: staging and production validation still pending
- Customer-facing impact: new end-to-end delivery risk platform release

## Required Evidence

- Static readiness check output (`go-live-readiness` `npm run check`): PASS (captured in rehearsal report)
- Live readiness check output (`go-live-readiness` `npm run check:live`): PASS (captured in rehearsal report)
- Smoke check output (`go-live-readiness` `npm run smoke`): PASS (captured in rehearsal report)
- Release rehearsal report (`go-live-readiness/reports/release-rehearsal-*.md`): [ai-delivery-risk/go-live-readiness/reports/release-rehearsal-20260429-201927.md](../reports/release-rehearsal-20260429-201927.md)
- Release automation output (`release-test-automation` `npm test`): PASS (captured in rehearsal report)
- Observability dashboard snapshot: TBD (staging/prod)
- Alerting verification notes: TBD (staging/prod)

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
- [ ] Release checklist blockers closed in staging/prod

### NO-GO triggers

- [ ] Any failed release gate command in target environment
- [ ] Unresolved high-risk dependency outage
- [ ] Missing rollback owner or untested rollback path

## Approval Sign-Off

- Engineering Lead: ____________________ Date/Time: __________
- Platform Lead: _______________________ Date/Time: __________
- QA Lead: _____________________________ Date/Time: __________
- Product Owner: _______________________ Date/Time: __________

## Final Decision

- Decision: PENDING (staging/prod sign-off required)
- Decision Timestamp:
- Notes:

## Post-Release Verification

- [ ] `check:live` re-run succeeded after deployment
- [ ] `smoke` re-run succeeded after deployment
- [ ] 30-minute stability window passed
- [ ] No sustained alert threshold breaches
- [ ] Stakeholder confirmation posted
