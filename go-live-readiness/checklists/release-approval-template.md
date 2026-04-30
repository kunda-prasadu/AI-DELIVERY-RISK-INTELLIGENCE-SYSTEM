# Release Approval Template

## Release Metadata

- Release ID:
- Date:
- Target Environment: staging / production
- Commit / Tag:
- Change Window:
- Release Manager:
- Incident Commander:
- Rollback Operator:

## Scope

- Included services:
- Excluded services:
- Known risks:
- Customer-facing impact:

## Required Evidence

Attach links or paths for each item.

- Static readiness check output (`go-live-readiness` `npm run check`):
- Compliance check output (`go-live-readiness` `npm run check:compliance`):
- MFA enforcement check output (`go-live-readiness` `npm run check:mfa`):
- DR and backup check output (`go-live-readiness` `npm run check:dr`):
- Weekly report check output (`go-live-readiness` `npm run check:weekly-report`):
- Defect burn-down output (`go-live-readiness` `npm run check:defects`):
- Hypercare SLA output (`go-live-readiness` `npm run check:hypercare`):
- Live readiness check output (`go-live-readiness` `npm run check:live`):
- Smoke check output (`go-live-readiness` `npm run smoke`):
- Release rehearsal report (`go-live-readiness/reports/release-rehearsal-*.md`):
- Release automation output (`release-test-automation` `npm test`):
- Observability dashboard snapshot:
- Alerting verification notes:

## Technical Gate Checklist

- [ ] Startup order confirmed.
- [ ] `JWT_SECRET` aligned across identity, project, and gateway.
- [ ] Gateway upstream configuration validated (`/auth`, `/projects`, `/metrics`).
- [ ] No blocking Sev-1/Sev-2 issues open.
- [ ] Rollback path validated and owner assigned.
- [ ] Incident communication channel prepared.

## Go / No-Go Criteria

### GO only if all are true

- [ ] `npm run check` passed
- [ ] `npm run check:compliance` passed
- [ ] `npm run check:mfa` passed
- [ ] `npm run check:dr` passed
- [ ] `npm run check:weekly-report` passed
- [ ] `npm run check:defects` passed
- [ ] `npm run check:hypercare` passed
- [ ] `npm run check:live` passed
- [ ] `npm run smoke` passed
- [ ] `release-test-automation` passed
- [ ] Release checklist blockers closed

### NO-GO triggers

- [ ] Any failed release gate command
- [ ] Unresolved high-risk dependency outage
- [ ] Missing rollback owner or untested rollback path

## Approval Sign-Off

- Engineering Lead: ____________________ Date/Time: __________
- Platform Lead: _______________________ Date/Time: __________
- QA Lead: _____________________________ Date/Time: __________
- Product Owner: _______________________ Date/Time: __________

## Final Decision

- Decision: GO / NO-GO
- Decision Timestamp:
- Notes:

## Post-Release Verification

- [ ] `check:live` re-run succeeded after deployment
- [ ] `smoke` re-run succeeded after deployment
- [ ] 30-minute stability window passed
- [ ] No sustained alert threshold breaches
- [ ] Stakeholder confirmation posted
