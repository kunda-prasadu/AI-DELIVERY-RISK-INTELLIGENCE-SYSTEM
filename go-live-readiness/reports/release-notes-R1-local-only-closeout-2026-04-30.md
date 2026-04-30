# Release Notes: R1 Local-Only Closeout

- Release ID: R1
- Release Date: 2026-04-30
- Release Tag: `R1-local-only-closeout-2026-04-30`
- Approval Record: [ai-delivery-risk/go-live-readiness/checklists/release-approval-R1-2026-04-29.md](../checklists/release-approval-R1-2026-04-29.md)

## Scope

- Finalized local-only production-like baseline for `identity-service`, `project-service`, `observability-service`, `metrics-normalization-service`, `api-gateway-service`, and `dashboard-shell`.
- Confirmed release gate, readiness rehearsal, and post-release closeout without any cloud deployment dependency.

## Included Validation

- `dashboard-shell` unit tests: PASS in CI release gate.
- `go-live-readiness` static check: PASS.
- `go-live-readiness` live check: PASS.
- `go-live-readiness` smoke flow: PASS.
- `release-test-automation`: PASS.
- Post-fix stability window: PASS.

## Operational Notes

- Resolved a false-negative Docker health status in `identity-service` by exempting `/health` from global rate limiting.
- Verified all compose services healthy for multiple hours after remediation.
- Verified no sustained critical log patterns across gateway and core backend services during final closeout.

## Release Artifacts

- Rehearsal report: [ai-delivery-risk/go-live-readiness/reports/release-rehearsal-20260429-225748.md](./release-rehearsal-20260429-225748.md)
- Latest readiness evidence: [ai-delivery-risk/go-live-readiness/reports/latest-readiness-evidence.md](./latest-readiness-evidence.md)
- Checkpoint tag retained: `R1-local-only-final-2026-04-29`
- Final closeout commit: `a6ab2a1`

## Outcome

- E-110 complete.
- Local-only release baseline approved, validated, and closed out.