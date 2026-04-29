'use strict';

/**
 * Insights Engine — generates structured recommendations from risk signals.
 *
 * Each insight has:
 *   id       — deterministic, based on trigger
 *   severity — INFO | WARNING | CRITICAL
 *   domain   — codeVelocity | quality | cicd | jiraVelocity
 *   title    — short summary
 *   detail   — actionable description
 *   action   — recommended next step
 */

const INSIGHT_RULES = [
  // ── Code Velocity ────────────────────────────────────────────────────────
  {
    id: 'CV-001',
    domain: 'codeVelocity',
    trigger: s => s.codeVelocity >= 70,
    severity: 'CRITICAL',
    title: 'Commit activity critically low',
    detail: 'Fewer than 3 commits in the last 24 hours — possible team blocker or merge freeze.',
    action: 'Confirm no active merge freeze; check standup blockers and unblock open PRs.',
  },
  {
    id: 'CV-002',
    domain: 'codeVelocity',
    trigger: s => s.codeVelocity >= 40 && s.codeVelocity < 70,
    severity: 'WARNING',
    title: 'Code velocity below expected',
    detail: 'Commit and PR activity is below the healthy threshold for this sprint phase.',
    action: 'Review open pull requests and identify any stalled branches.',
  },
  // ── Quality ──────────────────────────────────────────────────────────────
  {
    id: 'QA-001',
    domain: 'quality',
    trigger: s => s.quality >= 60,
    severity: 'CRITICAL',
    title: 'High rate of critical test failures',
    detail: 'More than 60% of test runs have critical severity in the current window.',
    action: 'Halt new feature work; assign QA lead to triage failing suites immediately.',
  },
  {
    id: 'QA-002',
    domain: 'quality',
    trigger: s => s.quality >= 30 && s.quality < 60,
    severity: 'WARNING',
    title: 'Elevated test warning rate',
    detail: 'Test runs showing a significant proportion of warnings — quality trend degrading.',
    action: 'Schedule test review session; identify flaky tests vs real regressions.',
  },
  // ── CI/CD ────────────────────────────────────────────────────────────────
  {
    id: 'CICD-001',
    domain: 'cicd',
    trigger: s => s.cicd >= 60,
    severity: 'CRITICAL',
    title: 'CI/CD pipeline failure rate critical',
    detail: 'Over 60% of builds in the last 24 hours have failed — deployment pipeline at risk.',
    action: 'Pin last green build; investigate pipeline logs for systemic failures.',
  },
  {
    id: 'CICD-002',
    domain: 'cicd',
    trigger: s => s.cicd >= 30 && s.cicd < 60,
    severity: 'WARNING',
    title: 'CI/CD builds intermittently failing',
    detail: 'Build failure rate is elevated — could indicate flaky infrastructure or test instability.',
    action: 'Review CI run logs; check for resource exhaustion or test timeouts.',
  },
  // ── Jira Velocity ────────────────────────────────────────────────────────
  {
    id: 'JV-001',
    domain: 'jiraVelocity',
    trigger: s => s.jiraVelocity >= 70,
    severity: 'CRITICAL',
    title: 'Sprint velocity critically low',
    detail: 'Fewer than 3 issues closed in the last 7 days — delivery target at risk.',
    action: 'Escalate to program manager; review blockers in backlog refinement.',
  },
  {
    id: 'JV-002',
    domain: 'jiraVelocity',
    trigger: s => s.jiraVelocity >= 40 && s.jiraVelocity < 70,
    severity: 'WARNING',
    title: 'Sprint velocity below target',
    detail: 'Issue closure rate is trending below expected pace for this sprint.',
    action: 'Re-prioritise backlog; consider splitting large tickets to show incremental progress.',
  },
];

/**
 * Generate insights for a given risk signal set.
 *
 * @param {string} projectId
 * @param {{ codeVelocity, quality, cicd, jiraVelocity }} signals
 * @param {string} band   — overall risk band (LOW/MEDIUM/HIGH/CRITICAL)
 * @returns {Array<Insight>}
 */
function generateInsights(projectId, signals, band) {
  const insights = INSIGHT_RULES
    .filter(rule => rule.trigger(signals))
    .map(rule => ({
      id:       rule.id,
      domain:   rule.domain,
      severity: rule.severity,
      title:    rule.title,
      detail:   rule.detail,
      action:   rule.action,
    }));

  // Always add a summary insight
  const summary = {
    id: 'SUMMARY',
    domain: 'overall',
    severity: band === 'LOW' ? 'INFO' : band === 'MEDIUM' ? 'WARNING' : 'CRITICAL',
    title: `Overall risk: ${band}`,
    detail: `Aggregate risk score places this project in the ${band} band. ${insights.length} active signal(s) detected.`,
    action: band === 'LOW'
      ? 'Continue monitoring; no immediate action required.'
      : 'Review flagged signals and assign owners to remediation actions.',
  };

  return [summary, ...insights];
}

module.exports = { generateInsights, INSIGHT_RULES };
