'use strict';

const ProjectStore = require('./project.store');
const RiskEngine = require('./risk.engine');
const InsightsEngine = require('./insights.engine');
const RecommendationEngine = require('./recommendation.engine');

/**
 * Dashboard Metrics Engine
 * Computes team capacity, quality snapshot, and timeline health metrics
 * from existing project and risk data.
 */

// ── Team Capacity Analysis ─────────────────────────────────────────────

function computeTeamCapacity(filters = {}) {
  const projects = ProjectStore.listAll(filters);
  const teamStats = {};
  const teamProjectMap = {};

  // Aggregate projects by team
  for (const project of projects) {
    if (!project.team) continue;

    if (!teamStats[project.team]) {
      teamStats[project.team] = {
        team: project.team,
        projectCount: 0,
        activeProjectCount: 0,
        totalRisk: 0,
        avgRiskScore: 0,
        criticalCount: 0,
        highCount: 0,
      };
      teamProjectMap[project.team] = [];
    }

    teamStats[project.team].projectCount += 1;
    if (project.status === 'active' || project.status === 'at_risk') {
      teamStats[project.team].activeProjectCount += 1;
    }

    const riskScore = RiskEngine.computeScore(project.id);
    teamStats[project.team].totalRisk += riskScore.score;

    if (riskScore.band === 'CRITICAL') {
      teamStats[project.team].criticalCount += 1;
    } else if (riskScore.band === 'HIGH') {
      teamStats[project.team].highCount += 1;
    }

    teamProjectMap[project.team].push({
      id: project.id,
      name: project.name,
      riskScore: riskScore.score,
      band: riskScore.band,
      status: project.status,
    });
  }

  // Calculate averages and utilization
  const teamCapacityList = Object.values(teamStats).map((team) => ({
    ...team,
    avgRiskScore: team.projectCount > 0 ? Math.round(team.totalRisk / team.projectCount) : 0,
    utilizationPercentage: team.projectCount > 0 ? Math.round((team.activeProjectCount / team.projectCount) * 100) : 0,
    riskLevel: team.avgRiskScore >= 70 ? 'CRITICAL' : team.avgRiskScore >= 50 ? 'HIGH' : team.avgRiskScore >= 30 ? 'MEDIUM' : 'LOW',
    topRiskProjects: teamProjectMap[team.team]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 2),
  }));

  return {
    teams: teamCapacityList.sort((a, b) => b.avgRiskScore - a.avgRiskScore),
    totalTeams: teamCapacityList.length,
    overloadedTeams: teamCapacityList.filter((t) => t.utilizationPercentage > 75).length,
    generatedAt: new Date().toISOString(),
  };
}

// ── Quality Snapshot Analysis ──────────────────────────────────────────

function computeQualitySnapshot(filters = {}) {
  const projects = ProjectStore.listAll(filters);
  let totalQualityScore = 0;
  let projectsWithQuality = 0;
  let highQualityCount = 0;
  let lowQualityCount = 0;
  const qualityByProject = [];

  for (const project of projects) {
    if (project.status !== 'active' && project.status !== 'at_risk') {
      continue;
    }

    const riskScore = RiskEngine.computeScore(project.id);
    const qualitySignal = riskScore.signals.quality || 0;

    totalQualityScore += qualitySignal;
    projectsWithQuality += 1;

    if (qualitySignal >= 70) {
      highQualityCount += 1;
    }
    if (qualitySignal < 40) {
      lowQualityCount += 1;
    }

    qualityByProject.push({
      projectId: project.id,
      projectName: project.name,
      team: project.team,
      qualityScore: qualitySignal,
      qualityLevel: qualitySignal >= 70 ? 'HIGH' : qualitySignal >= 50 ? 'MEDIUM' : 'LOW',
      codeVelocity: riskScore.signals.codeVelocity || 0,
      cicdScore: riskScore.signals.cicd || 0,
    });
  }

  const avgQualityScore = projectsWithQuality > 0 ? Math.round(totalQualityScore / projectsWithQuality) : 0;

  return {
    portfolioQualityScore: avgQualityScore,
    qualityLevel: avgQualityScore >= 70 ? 'HIGH' : avgQualityScore >= 50 ? 'MEDIUM' : 'LOW',
    projectsTracked: projectsWithQuality,
    highQualityProjects: highQualityCount,
    lowQualityProjects: lowQualityCount,
    qualityAtRisk: lowQualityCount,
    qualityTrend: avgQualityScore >= 60 ? 'stable' : avgQualityScore >= 50 ? 'watch' : 'declining',
    topProjectsByQuality: qualityByProject
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, 5),
    lowestQualityProjects: qualityByProject
      .sort((a, b) => a.qualityScore - b.qualityScore)
      .slice(0, 3),
    generatedAt: new Date().toISOString(),
  };
}

// ── Timeline Health Analysis ──────────────────────────────────────────

function computeTimelineHealth(filters = {}) {
  const projects = ProjectStore.listAll(filters);
  const now = new Date();
  const timelineProjects = [];
  let onTrackCount = 0;
  let atRiskCount = 0;
  let delayedCount = 0;

  for (const project of projects) {
    if (project.status === 'completed') {
      continue;
    }

    if (!project.startDate || !project.targetDate) {
      continue;
    }

    const startDate = new Date(project.startDate);
    const targetDate = new Date(project.targetDate);
    const totalDuration = targetDate - startDate;
    const elapsed = now - startDate;
    const remaining = targetDate - now;
    const percentComplete = totalDuration > 0 ? Math.round((elapsed / totalDuration) * 100) : 0;

    // Estimate if on track using risk score as a proxy for velocity
    const riskScore = RiskEngine.computeScore(project.id);
    const codeVelocity = riskScore.signals.codeVelocity || 50;
    const jiraVelocity = riskScore.signals.jiraVelocity || 50;
    const avgVelocity = (codeVelocity + jiraVelocity) / 2;

    let timelineStatus = 'on_track';
    let estimatedDaysRemaining = remaining > 0 ? Math.ceil(remaining / (1000 * 60 * 60 * 24)) : 0;

    // If velocity is low and we're past 50% of time, flag as at risk
    if (percentComplete > 50 && avgVelocity < 50) {
      timelineStatus = 'at_risk';
      atRiskCount += 1;
    } else if (remaining < 0) {
      timelineStatus = 'delayed';
      delayedCount += 1;
      estimatedDaysRemaining = Math.ceil(Math.abs(remaining) / (1000 * 60 * 60 * 24));
    } else {
      onTrackCount += 1;
    }

    timelineProjects.push({
      projectId: project.id,
      projectName: project.name,
      team: project.team,
      startDate: project.startDate,
      targetDate: project.targetDate,
      percentComplete,
      daysRemaining: estimatedDaysRemaining,
      status: timelineStatus,
      riskScore: riskScore.score,
      velocityIndicator: avgVelocity >= 70 ? 'strong' : avgVelocity >= 50 ? 'nominal' : 'weak',
    });
  }

  return {
    projectsTracked: timelineProjects.length,
    onTrackProjects: onTrackCount,
    atRiskProjects: atRiskCount,
    delayedProjects: delayedCount,
    timelineHealthPercentage:
      timelineProjects.length > 0 ? Math.round(((onTrackCount + (atRiskCount * 0.3)) / timelineProjects.length) * 100) : 0,
    criticalPath: timelineProjects
      .filter((p) => p.status === 'at_risk' || p.status === 'delayed')
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5),
    earlyWarnings: timelineProjects
      .filter((p) => p.status === 'at_risk' && p.percentComplete >= 40)
      .map((p) => ({
        projectName: p.projectName,
        daysRemaining: p.daysRemaining,
        percentComplete: p.percentComplete,
        reason: p.velocityIndicator === 'weak' ? 'Low velocity detected' : 'Off baseline schedule',
      })),
    generatedAt: new Date().toISOString(),
  };
}

// ── Dependency Map Analysis ────────────────────────────────────────────

const TEAM_UPSTREAM_DEPENDENCIES = Object.freeze({
  mobile: ['platform', 'security', 'data'],
  platform: ['security', 'data'],
  security: ['platform'],
  data: ['platform'],
});

function toRiskTier(score) {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function computeDependencyMap(filters = {}) {
  const projects = ProjectStore.listAll(filters);
  const projectsByTeam = projects.reduce((acc, project) => {
    if (!acc[project.team]) {
      acc[project.team] = [];
    }
    acc[project.team].push(project);
    return acc;
  }, {});

  const edges = [];

  for (const project of projects) {
    const upstreamTeams = TEAM_UPSTREAM_DEPENDENCIES[project.team] || [];

    for (const upstreamTeam of upstreamTeams) {
      const upstreamCandidates = projectsByTeam[upstreamTeam] || [];
      if (!upstreamCandidates.length) {
        continue;
      }

      const highestRiskUpstream = upstreamCandidates
        .map((candidate) => ({
          project: candidate,
          risk: RiskEngine.computeScore(candidate.id),
        }))
        .sort((a, b) => b.risk.score - a.risk.score)[0];

      if (!highestRiskUpstream || highestRiskUpstream.project.id === project.id) {
        continue;
      }

      const blockerScore = highestRiskUpstream.risk.score;
      const blocked = blockerScore >= 50;

      edges.push({
        sourceProjectId: highestRiskUpstream.project.id,
        sourceProjectName: highestRiskUpstream.project.name,
        sourceTeam: highestRiskUpstream.project.team,
        targetProjectId: project.id,
        targetProjectName: project.name,
        targetTeam: project.team,
        blockerRiskScore: blockerScore,
        blockerRiskBand: highestRiskUpstream.risk.band,
        dependencyType: 'upstream_service',
        blocked,
      });
    }
  }

  const blockedProjectIds = new Set(edges.filter((edge) => edge.blocked).map((edge) => edge.targetProjectId));
  const criticalBlockers = edges.filter((edge) => edge.blockerRiskScore >= 70).length;

  return {
    projectsTracked: projects.length,
    dependencyLinks: edges.length,
    blockedProjects: blockedProjectIds.size,
    criticalBlockers,
    atRiskDependencies: edges
      .filter((edge) => edge.blocked)
      .sort((a, b) => b.blockerRiskScore - a.blockerRiskScore)
      .slice(0, 8)
      .map((edge) => ({
        ...edge,
        blockerRiskTier: toRiskTier(edge.blockerRiskScore),
      })),
    generatedAt: new Date().toISOString(),
  };
}

// ── Release Readiness Analysis ─────────────────────────────────────────

function computeReleaseReadiness(filters = {}) {
  const projects = ProjectStore.listAll(filters);
  const tracked = projects.filter((project) => project.status === 'active' || project.status === 'at_risk');
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  const perProject = tracked.map((project) => {
    const risk = RiskEngine.computeScore(project.id);
    const quality = risk.signals.quality || 0;
    const cicd = risk.signals.cicd || 0;
    const jiraVelocity = risk.signals.jiraVelocity || 0;
    const codeVelocity = risk.signals.codeVelocity || 0;

    const readinessScore = Math.max(
      0,
      Math.min(100, Math.round((quality * 0.35) + (cicd * 0.35) + (jiraVelocity * 0.2) + (codeVelocity * 0.1)))
    );

    const targetDate = project.targetDate ? new Date(project.targetDate).getTime() : null;
    const targetWithinNinetyDays = typeof targetDate === 'number' && targetDate >= now && targetDate - now <= ninetyDaysMs;

    const blockers = [];
    if (risk.band === 'CRITICAL' || risk.band === 'HIGH') {
      blockers.push('Risk score too high');
    }
    if (quality < 50) {
      blockers.push('Quality gate below threshold');
    }
    if (cicd < 55) {
      blockers.push('CI/CD stability below threshold');
    }

    return {
      projectId: project.id,
      projectName: project.name,
      team: project.team,
      readinessScore,
      releaseWindow: targetWithinNinetyDays ? 'next_90_days' : 'later',
      blockers,
      quality,
      cicd,
      jiraVelocity,
    };
  });

  const portfolioReadinessScore = perProject.length
    ? Math.round(perProject.reduce((sum, item) => sum + item.readinessScore, 0) / perProject.length)
    : 0;

  const releaseCandidates = perProject.filter((item) => item.readinessScore >= 70 && item.releaseWindow === 'next_90_days').length;
  const blockedReleases = perProject.filter((item) => item.blockers.length > 0).length;

  const avgQuality = perProject.length ? Math.round(perProject.reduce((sum, item) => sum + item.quality, 0) / perProject.length) : 0;
  const avgCicd = perProject.length ? Math.round(perProject.reduce((sum, item) => sum + item.cicd, 0) / perProject.length) : 0;
  const avgJiraVelocity = perProject.length ? Math.round(perProject.reduce((sum, item) => sum + item.jiraVelocity, 0) / perProject.length) : 0;

  return {
    projectsTracked: perProject.length,
    portfolioReadinessScore,
    releaseCandidates,
    blockedReleases,
    readinessLevel: portfolioReadinessScore >= 75 ? 'HIGH' : portfolioReadinessScore >= 60 ? 'MEDIUM' : 'LOW',
    checklistCompletion: {
      qaGate: avgQuality,
      ciStability: avgCicd,
      deliveryPredictability: avgJiraVelocity,
    },
    projects: perProject
      .sort((a, b) => a.readinessScore - b.readinessScore)
      .slice(0, 8),
    generatedAt: new Date().toISOString(),
  };
}

// ── Budget Health Analysis ─────────────────────────────────────────────

const TEAM_BUDGET_BASELINES = Object.freeze({
  platform: 800000,
  security: 500000,
  data: 900000,
  mobile: 700000,
});

function getExecutionMultiplier(status) {
  if (status === 'at_risk') return 1.15;
  if (status === 'paused') return 0.65;
  if (status === 'active') return 0.9;
  return 0.8;
}

function computeBudgetHealth(filters = {}) {
  const projects = ProjectStore.listAll(filters);

  const perProject = projects.map((project) => {
    const baselineBudget = TEAM_BUDGET_BASELINES[project.team] || 600000;
    const risk = RiskEngine.computeScore(project.id);
    const riskPenalty = baselineBudget * (risk.score / 100) * 0.35;
    const executionSpend = baselineBudget * getExecutionMultiplier(project.status);
    const projectedSpend = Math.round(executionSpend + riskPenalty);

    const variance = projectedSpend - baselineBudget;
    const variancePercentage = Math.round((variance / baselineBudget) * 100);
    const budgetStatus = variancePercentage > 10 ? 'over_budget' : variancePercentage > 0 ? 'watch' : 'healthy';

    return {
      projectId: project.id,
      projectName: project.name,
      team: project.team,
      plannedBudget: baselineBudget,
      projectedSpend,
      variance,
      variancePercentage,
      riskScore: risk.score,
      budgetStatus,
    };
  });

  const totalPlanned = perProject.reduce((sum, item) => sum + item.plannedBudget, 0);
  const totalProjected = perProject.reduce((sum, item) => sum + item.projectedSpend, 0);
  const totalVariance = totalProjected - totalPlanned;
  const totalVariancePercentage = totalPlanned > 0 ? Math.round((totalVariance / totalPlanned) * 100) : 0;

  return {
    projectsTracked: perProject.length,
    totalPlannedBudget: totalPlanned,
    totalProjectedSpend: totalProjected,
    totalVariance,
    totalVariancePercentage,
    budgetHealthStatus: totalVariancePercentage > 10 ? 'over_budget' : totalVariancePercentage > 0 ? 'watch' : 'healthy',
    overBudgetProjects: perProject.filter((item) => item.variancePercentage > 10).length,
    watchProjects: perProject.filter((item) => item.variancePercentage > 0 && item.variancePercentage <= 10).length,
    topOverruns: perProject
      .filter((item) => item.variance > 0)
      .sort((a, b) => b.variance - a.variance)
      .slice(0, 6),
    generatedAt: new Date().toISOString(),
  };
}

// ── Recommendation Adoption Analysis ───────────────────────────────────

function toAdoptionRiskLevel(estimatedAdoptionRate) {
  if (estimatedAdoptionRate >= 75) return 'LOW';
  if (estimatedAdoptionRate >= 55) return 'MEDIUM';
  return 'HIGH';
}

function toOwnerWorkloadRiskLevel(recommendationCount, highPriorityCount) {
  if (recommendationCount >= 5 || highPriorityCount >= 3) return 'HIGH';
  if (recommendationCount >= 3 || highPriorityCount >= 1) return 'MEDIUM';
  return 'LOW';
}

function collectTrackedRecommendations(filters = {}) {
  const trackedProjects = ProjectStore.listAll(filters).filter((project) => project.status === 'active' || project.status === 'at_risk');
  const recommendations = [];

  for (const project of trackedProjects) {
    const riskScore = RiskEngine.computeScore(project.id);
    const insights = InsightsEngine.generateInsights(project.id, riskScore.signals, riskScore.band);
    const generated = RecommendationEngine.generateRecommendations(project.id, riskScore, insights);

    for (const recommendation of generated) {
      recommendations.push({
        ...recommendation,
        projectName: project.name,
        team: project.team,
      });
    }
  }

  return { trackedProjects, recommendations };
}

function computeRecommendationAdoption(filters = {}) {
  const { trackedProjects, recommendations } = collectTrackedRecommendations(filters);

  const totalRecommendations = recommendations.length;
  const activeRecommendations = recommendations.filter((item) => item.status !== 'DONE').length;
  const highPriorityRecommendations = recommendations.filter((item) => item.priority === 'P1').length;
  const averageConfidence = totalRecommendations
    ? Math.round(recommendations.reduce((sum, item) => sum + item.confidence, 0) / totalRecommendations)
    : 0;

  const highPriorityShare = totalRecommendations ? highPriorityRecommendations / totalRecommendations : 0;
  const estimatedAdoptionRate = Math.max(0, Math.min(100, Math.round((averageConfidence * 0.7) + ((1 - highPriorityShare) * 30))));

  const ownerRoleCounts = recommendations.reduce((acc, item) => {
    acc[item.ownerRole] = (acc[item.ownerRole] || 0) + 1;
    return acc;
  }, {});

  const topOwners = Object.entries(ownerRoleCounts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([ownerRole, recommendationCount]) => ({ ownerRole, recommendationCount }));

  const topRecommendations = recommendations
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority.localeCompare(right.priority);
      }
      return right.confidence - left.confidence;
    })
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      projectId: item.projectId,
      projectName: item.projectName,
      team: item.team,
      title: item.title,
      priority: item.priority,
      ownerRole: item.ownerRole,
      confidence: item.confidence,
      status: item.status,
    }));

  return {
    projectsTracked: trackedProjects.length,
    totalRecommendations,
    activeRecommendations,
    highPriorityRecommendations,
    averageConfidence,
    estimatedAdoptionRate,
    adoptionRiskLevel: toAdoptionRiskLevel(estimatedAdoptionRate),
    topOwners,
    topRecommendations,
    generatedAt: new Date().toISOString(),
  };
}

function computeOwnerWorkload(filters = {}) {
  const { trackedProjects, recommendations } = collectTrackedRecommendations(filters);
  const ownerBuckets = recommendations.reduce((acc, item) => {
    if (!acc[item.ownerRole]) {
      acc[item.ownerRole] = {
        ownerRole: item.ownerRole,
        recommendationCount: 0,
        highPriorityCount: 0,
        confidenceTotal: 0,
        projectIds: new Set(),
      };
    }

    acc[item.ownerRole].recommendationCount += 1;
    acc[item.ownerRole].confidenceTotal += item.confidence;
    acc[item.ownerRole].projectIds.add(item.projectId);
    if (item.priority === 'P1') {
      acc[item.ownerRole].highPriorityCount += 1;
    }

    return acc;
  }, {});

  const owners = Object.values(ownerBuckets)
    .map((owner) => ({
      ownerRole: owner.ownerRole,
      recommendationCount: owner.recommendationCount,
      highPriorityCount: owner.highPriorityCount,
      projectCount: owner.projectIds.size,
      averageConfidence: owner.recommendationCount ? Math.round(owner.confidenceTotal / owner.recommendationCount) : 0,
      workloadRiskLevel: toOwnerWorkloadRiskLevel(owner.recommendationCount, owner.highPriorityCount),
    }))
    .sort((left, right) => {
      if (right.recommendationCount !== left.recommendationCount) {
        return right.recommendationCount - left.recommendationCount;
      }
      return right.highPriorityCount - left.highPriorityCount;
    });

  const ownersTracked = owners.length;
  const overloadedOwners = owners.filter((owner) => owner.workloadRiskLevel === 'HIGH').length;
  const workloadRiskLevel = overloadedOwners > 0
    ? 'HIGH'
    : owners.some((owner) => owner.workloadRiskLevel === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

  return {
    projectsTracked: trackedProjects.length,
    ownersTracked,
    overloadedOwners,
    highestOwnerLoad: owners[0]?.recommendationCount || 0,
    averageRecommendationsPerOwner: ownersTracked ? Math.round((recommendations.length / ownersTracked) * 10) / 10 : 0,
    workloadRiskLevel,
    topOwners: owners.slice(0, 5),
    generatedAt: new Date().toISOString(),
  };
}

// ── Portfolio Overview ─────────────────────────────────────────────────

function computeDashboardMetricsSnapshot(filters = {}) {
  return {
    teamCapacity: computeTeamCapacity(filters),
    qualitySnapshot: computeQualitySnapshot(filters),
    timelineHealth: computeTimelineHealth(filters),
    dependencyMap: computeDependencyMap(filters),
    releaseReadiness: computeReleaseReadiness(filters),
    budgetHealth: computeBudgetHealth(filters),
    recommendationAdoption: computeRecommendationAdoption(filters),
    ownerWorkload: computeOwnerWorkload(filters),
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  computeTeamCapacity,
  computeQualitySnapshot,
  computeTimelineHealth,
  computeDependencyMap,
  computeReleaseReadiness,
  computeBudgetHealth,
  computeRecommendationAdoption,
  computeOwnerWorkload,
  computeDashboardMetricsSnapshot,
};
