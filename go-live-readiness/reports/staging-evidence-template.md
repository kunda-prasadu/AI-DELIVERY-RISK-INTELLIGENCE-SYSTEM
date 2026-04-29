# Staging Evidence Template

- Timestamp: <UTC timestamp>
- Environment: Render Staging
- Gateway Base URL: <https://...>
- Overall: <PASS|FAIL>

## Deployment Metadata

- Commit SHA: <sha>
- Branch: <branch>
- Render Blueprint/Deploy ID: <id>
- Trigger: <manual|push|PR>

## Validation Commands

- `npm run check:staging`
- `./scripts/validate-render-staging.sh`

## Readiness Summary

- Status: <PASS|FAIL>
- Checks: <n>
- Failures: <n>
- Warnings: <n>
- Skipped: <n>

## Smoke Summary

- Register: <status>
- Projects: <status>
- Risk score: <status>
- Metrics ingest: <status>
- Metrics summary: <status>
- Observability: <status>

## URLs

- Dashboard: <https://...>
- Gateway health: <https://.../health>
- Identity health: <https://.../health>
- Project health: <https://.../health>
- Observability live: <https://.../health/live>
- Metrics live: <https://.../health/live>

## Notes

- <operational notes>
- <known issues / exceptions>
