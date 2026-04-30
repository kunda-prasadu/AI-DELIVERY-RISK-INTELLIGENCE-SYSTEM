'use strict';

const RecommendationEngine = require('./recommendation.engine');

function summarizeInsights(insights) {
  const summary = {
    totalInsights: insights.length,
    severityCounts: { INFO: 0, WARNING: 0, CRITICAL: 0 },
    domainCounts: {},
  };

  for (const insight of insights) {
    if (summary.severityCounts[insight.severity] !== undefined) {
      summary.severityCounts[insight.severity] += 1;
    }

    summary.domainCounts[insight.domain] = (summary.domainCounts[insight.domain] || 0) + 1;
  }

  return summary;
}

function averageConfidence(recommendations) {
  if (!recommendations.length) {
    return 0;
  }

  const total = recommendations.reduce((sum, recommendation) => sum + recommendation.confidence, 0);
  return Math.round(total / recommendations.length);
}

function buildAgentWorkbench(project, riskScore, insights, recommendations, options = {}) {
  const insightSummary = summarizeInsights(insights);
  const recommendationSummary = RecommendationEngine.summarizeRecommendations(recommendations);
  const insightLimit = options.insightLimit || 3;
  const recommendationLimit = options.recommendationLimit || 3;

  return {
    projectId: project.id,
    projectName: project.name,
    team: project.team,
    status: project.status,
    riskScore: riskScore.score,
    band: riskScore.band,
    generatedAt: new Date().toISOString(),
    agents: [
      {
        key: 'data-ingestion',
        name: 'Data Ingestion Agent',
        status: riskScore.eventCount > 0 ? 'ACTIVE' : 'WATCH',
        summary: {
          eventCount: riskScore.eventCount,
          signalSources: Object.keys(riskScore.signals || {}).length,
          pipelineHealth: riskScore.eventCount > 0 ? 'streaming' : 'awaiting-events',
        },
      },
      {
        key: 'risk-detection',
        name: 'Risk Detection Agent',
        status: insightSummary.totalInsights > 1 ? 'ACTIVE' : 'MONITORING',
        summary: {
          totalInsights: insightSummary.totalInsights,
          criticalInsights: insightSummary.severityCounts.CRITICAL,
          leadingDomain: Object.entries(insightSummary.domainCounts)
            .sort((left, right) => right[1] - left[1])[0]?.[0] || 'overall',
        },
      },
      {
        key: 'recommendation',
        name: 'Recommendation Agent',
        status: recommendationSummary.totalRecommendations > 0 ? 'ACTIVE' : 'IDLE',
        summary: {
          totalRecommendations: recommendationSummary.totalRecommendations,
          p1Recommendations: recommendationSummary.priorityCounts.P1,
          averageConfidence: averageConfidence(recommendations),
        },
      },
      {
        key: 'feedback-learning',
        name: 'Feedback Learning Agent',
        status: 'READY',
        summary: {
          targetTypes: ['recommendation', 'insight', 'anomaly', 'report'],
          loopState: 'feedback-enabled',
        },
      },
    ],
    summaries: {
      insights: insightSummary,
      recommendations: recommendationSummary,
    },
    previews: {
      insights: insights.slice(0, insightLimit),
      recommendations: recommendations.slice(0, recommendationLimit),
    },
    nextActions: recommendations.slice(0, recommendationLimit).map((recommendation) => ({
      id: recommendation.id,
      priority: recommendation.priority,
      ownerRole: recommendation.ownerRole,
      title: recommendation.title,
      description: recommendation.description,
    })),
  };
}

module.exports = {
  buildAgentWorkbench,
  summarizeInsights,
};