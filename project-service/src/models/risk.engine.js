'use strict';

const config = require('../config/project.config');
const EventStore = require('./event.store');

/**
 * Risk Engine — computes a weighted risk score (0-100) from NormalizedEvents.
 *
 * Signal domains:
 *   1. Code Velocity   — commit frequency + PR throughput
 *   2. Quality         — test pass rate + critical event ratio
 *   3. CI/CD Health    — build success rate
 *   4. Jira Velocity   — issue closure rate vs 7-day window
 *
 * Each domain score is 0–100 (higher = more risk).
 * Final score = weighted sum using config.risk.weights.
 * Severity band: LOW (0-25) / MEDIUM (26-50) / HIGH (51-75) / CRITICAL (76-100)
 */

// ── Helpers ────────────────────────────────────────────────────────────────

/** Clamp a value to [0, 100] */
const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

/**
 * Determine the severity band label for a score.
 * @param {number} score  0-100
 * @returns {string}
 */
function getBand(score) {
  const bands = config.risk.bands;
  for (const band of bands) {
    if (score >= band.min && score <= band.max) return band.label;
  }
  return 'UNKNOWN';
}

// ── Domain scorers ─────────────────────────────────────────────────────────

/**
 * Code Velocity score (0-100, higher = more risk).
 * Low commit frequency in last 24h or no merged PRs in 48h → higher risk.
 */
function scoreCodeVelocity(events) {
  const since24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const since48h = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const commits = events.filter(e => e.source === 'github' && e.eventType === 'commit' && e.timestamp >= since24h).length;
  const prs     = events.filter(e => e.source === 'github' && e.eventType === 'pr_merged' && e.timestamp >= since48h).length;

  // Risk increases when activity drops below thresholds
  const commitRisk = commits === 0 ? 80 : commits < 3 ? 60 : commits < 8 ? 30 : 10;
  const prRisk     = prs     === 0 ? 70 : prs     < 2 ? 40 : 15;

  return clamp((commitRisk + prRisk) / 2);
}

/**
 * Quality score (0-100, higher = more risk).
 * Driven by critical/warning severity ratio and failing test runs.
 */
function scoreQuality(events) {
  const testEvents = events.filter(e => e.source === 'qa');
  if (testEvents.length === 0) return 50; // unknown — medium risk

  const criticalCount = testEvents.filter(e => e.severity === 'critical').length;
  const warningCount  = testEvents.filter(e => e.severity === 'warning').length;
  const total         = testEvents.length;

  const critRatio    = criticalCount / total;
  const warningRatio = warningCount  / total;

  return clamp(critRatio * 90 + warningRatio * 40);
}

/**
 * CI/CD Health score (0-100, higher = more risk).
 * Based on build failure rate in last 24h.
 */
function scoreCICD(events) {
  const since24h    = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const cicdEvents  = events.filter(e => e.source === 'cicd' && e.timestamp >= since24h);

  if (cicdEvents.length === 0) return 40; // no data — slightly elevated

  const failures = cicdEvents.filter(e => e.eventType === 'build_failure').length;
  const total    = cicdEvents.length;
  const failRate = failures / total;

  return clamp(failRate * 100);
}

/**
 * Jira Velocity score (0-100, higher = more risk).
 * Low issue closure in last 7 days → higher risk.
 */
function scoreJiraVelocity(events) {
  const since7d = new Date(Date.now() - 168 * 3_600_000).toISOString();
  const closed  = events.filter(e => e.source === 'jira' && e.eventType === 'issue_closed' && e.timestamp >= since7d).length;

  return closed === 0 ? 80 : closed < 3 ? 60 : closed < 8 ? 35 : 10;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Compute the full risk score for a project.
 *
 * @param {string} projectId
 * @returns {{
 *   score: number,
 *   band: string,
 *   signals: { codeVelocity: number, quality: number, cicd: number, jiraVelocity: number },
 *   eventCount: number,
 *   computedAt: string
 * }}
 */
function computeScore(projectId) {
  const events = EventStore.getForProject(projectId);
  const w      = config.risk.weights;

  const signals = {
    codeVelocity:  scoreCodeVelocity(events),
    quality:       scoreQuality(events),
    cicd:          scoreCICD(events),
    jiraVelocity:  scoreJiraVelocity(events),
  };

  const score = clamp(
    signals.codeVelocity * w.codeVelocity +
    signals.quality      * w.quality      +
    signals.cicd         * w.cicd         +
    signals.jiraVelocity * w.jiraVelocity
  );

  return {
    projectId,
    score,
    band:       getBand(score),
    signals,
    eventCount: events.length,
    computedAt: new Date().toISOString(),
  };
}

module.exports = { computeScore, getBand, clamp };
