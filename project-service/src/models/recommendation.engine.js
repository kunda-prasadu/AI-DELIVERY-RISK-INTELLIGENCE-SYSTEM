'use strict';

const PRIORITY_BY_SEVERITY = {
  CRITICAL: 'P1',
  WARNING: 'P2',
  INFO: 'P3',
};

const OWNER_BY_DOMAIN = {
  codeVelocity: 'Engineering Lead',
  quality: 'QA Lead',
  cicd: 'DevOps Lead',
  jiraVelocity: 'Delivery Manager',
  overall: 'Program Manager',
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function toConfidence(severity, score) {
  const severityBonus = severity === 'CRITICAL' ? 25 : severity === 'WARNING' ? 15 : 8;
  return clamp(Math.round((score * 0.6) + severityBonus), 45, 95);
}

function generateRecommendations(projectId, riskScore, insights) {
  if (!Array.isArray(insights) || !riskScore) {
    return [];
  }

  const recommendations = insights.map((insight, index) => {
    const priority = PRIORITY_BY_SEVERITY[insight.severity] || 'P3';
    const ownerRole = OWNER_BY_DOMAIN[insight.domain] || 'Engineering Lead';

    return {
      id: `REC-${insight.id}-${index + 1}`,
      projectId,
      priority,
      domain: insight.domain,
      ownerRole,
      title: insight.title,
      description: insight.action,
      rationale: insight.detail,
      sourceInsightIds: [insight.id],
      confidence: toConfidence(insight.severity, riskScore.score),
      status: 'OPEN',
    };
  });

  const priorityRank = { P1: 1, P2: 2, P3: 3 };
  return recommendations.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}

function summarizeRecommendations(recommendations) {
  const summary = {
    totalRecommendations: recommendations.length,
    priorityCounts: { P1: 0, P2: 0, P3: 0 },
    ownerRoleCounts: {},
    domainCounts: {},
  };

  for (const recommendation of recommendations) {
    if (summary.priorityCounts[recommendation.priority] !== undefined) {
      summary.priorityCounts[recommendation.priority] += 1;
    }

    summary.ownerRoleCounts[recommendation.ownerRole] =
      (summary.ownerRoleCounts[recommendation.ownerRole] || 0) + 1;

    summary.domainCounts[recommendation.domain] =
      (summary.domainCounts[recommendation.domain] || 0) + 1;
  }

  return summary;
}

module.exports = {
  generateRecommendations,
  summarizeRecommendations,
};
