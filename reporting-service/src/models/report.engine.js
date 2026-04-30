'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Report types and their section builders.
 */
const REPORT_TYPES = ['executive-summary', 'risk-deep-dive', 'portfolio-health'];

/**
 * Derive a RAG (Red/Amber/Green) status from a numeric risk score (0–100).
 */
function ragStatus(score) {
  if (score >= 70) return 'RED';
  if (score >= 40) return 'AMBER';
  return 'GREEN';
}

/**
 * Build the portfolio-health section from raw project data.
 *
 * @param {Array<{id: string, name: string, riskScore: number, status: string}>} projects
 * @returns {{ totalProjects: number, atRisk: number, onTrack: number, ragBreakdown: object }}
 */
function buildPortfolioHealth(projects = []) {
  const breakdown = { RED: 0, AMBER: 0, GREEN: 0 };
  for (const p of projects) {
    const rag = ragStatus(p.riskScore || 0);
    breakdown[rag] += 1;
  }
  return {
    totalProjects: projects.length,
    atRisk: breakdown.RED + breakdown.AMBER,
    onTrack: breakdown.GREEN,
    ragBreakdown: breakdown,
  };
}

/**
 * Build the top-risks section — highest-scoring projects (up to limit).
 *
 * @param {Array<{id: string, name: string, riskScore: number, status: string}>} projects
 * @param {number} limit
 * @returns {Array}
 */
function buildTopRisks(projects = [], limit = 5) {
  return [...projects]
    .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
    .slice(0, limit)
    .map((p) => ({
      projectId: p.id,
      projectName: p.name,
      riskScore: p.riskScore || 0,
      rag: ragStatus(p.riskScore || 0),
      status: p.status || 'unknown',
    }));
}

/**
 * Build an executive-summary section.
 *
 * @param {object} opts
 * @param {Array} opts.projects
 * @param {number} opts.openInsights
 * @param {number} opts.openRecommendations
 * @param {number} opts.anomalyCount
 * @returns {object}
 */
function buildExecutiveSummary({ projects = [], openInsights = 0, openRecommendations = 0, anomalyCount = 0 } = {}) {
  const health = buildPortfolioHealth(projects);
  const avgRisk =
    projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.riskScore || 0), 0) / projects.length)
      : 0;
  return {
    portfolioHealth: health,
    averageRiskScore: avgRisk,
    overallRag: ragStatus(avgRisk),
    openInsights,
    openRecommendations,
    anomalyCount,
  };
}

/**
 * Render a report as a Markdown string.
 *
 * @param {object} report
 * @returns {string}
 */
function renderMarkdown(report) {
  const lines = [
    `# Executive Report — ${report.reportType}`,
    ``,
    `**Generated:** ${report.generatedAt}  `,
    `**Requested by:** ${report.requestedBy || 'system'}  `,
    `**Report ID:** ${report.reportId}`,
    ``,
  ];

  const s = report.sections || {};

  if (s.executiveSummary) {
    const es = s.executiveSummary;
    lines.push(`## Portfolio Health`);
    lines.push(`- Total projects: ${es.portfolioHealth.totalProjects}`);
    lines.push(`- At risk (RED+AMBER): ${es.portfolioHealth.atRisk}`);
    lines.push(`- On track (GREEN): ${es.portfolioHealth.onTrack}`);
    lines.push(`- Average risk score: ${es.averageRiskScore} — **${es.overallRag}**`);
    lines.push(`- Open insights: ${es.openInsights}`);
    lines.push(`- Open recommendations: ${es.openRecommendations}`);
    lines.push(`- Anomaly count: ${es.anomalyCount}`);
    lines.push(``);
  }

  if (s.topRisks && s.topRisks.length > 0) {
    lines.push(`## Top Risks`);
    lines.push(`| Project | Risk Score | RAG | Status |`);
    lines.push(`|---------|-----------|-----|--------|`);
    for (const r of s.topRisks) {
      lines.push(`| ${r.projectName} | ${r.riskScore} | ${r.rag} | ${r.status} |`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}

/**
 * Generate a full executive report object.
 *
 * @param {object} payload
 * @param {string} payload.reportType
 * @param {string} [payload.requestedBy]
 * @param {Array}  [payload.projects]
 * @param {number} [payload.openInsights]
 * @param {number} [payload.openRecommendations]
 * @param {number} [payload.anomalyCount]
 * @returns {object}
 */
function generateReport({
  reportType = 'executive-summary',
  requestedBy = 'system',
  projects = [],
  openInsights = 0,
  openRecommendations = 0,
  anomalyCount = 0,
} = {}) {
  const reportId = uuidv4();
  const generatedAt = new Date().toISOString();

  const sections = {
    executiveSummary: buildExecutiveSummary({ projects, openInsights, openRecommendations, anomalyCount }),
    topRisks: buildTopRisks(projects),
  };

  const report = {
    reportId,
    reportType,
    requestedBy,
    generatedAt,
    sections,
  };

  report.markdown = renderMarkdown(report);
  return report;
}

module.exports = {
  REPORT_TYPES,
  ragStatus,
  buildPortfolioHealth,
  buildTopRisks,
  buildExecutiveSummary,
  renderMarkdown,
  generateReport,
};
