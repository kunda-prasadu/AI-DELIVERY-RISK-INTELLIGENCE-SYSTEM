import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TeamCapacityMetrics {
  teams: Array<{
    team: string;
    projectCount: number;
    activeProjectCount: number;
    avgRiskScore: number;
    utilizationPercentage: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    criticalCount: number;
    highCount: number;
    topRiskProjects: Array<{
      id: string;
      name: string;
      riskScore: number;
      band: string;
      status: string;
    }>;
  }>;
  totalTeams: number;
  overloadedTeams: number;
  generatedAt: string;
}

export interface QualitySnapshot {
  portfolioQualityScore: number;
  qualityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  projectsTracked: number;
  highQualityProjects: number;
  lowQualityProjects: number;
  qualityAtRisk: number;
  qualityTrend: 'stable' | 'watch' | 'declining';
  topProjectsByQuality: Array<{
    projectId: string;
    projectName: string;
    team: string;
    qualityScore: number;
    qualityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    codeVelocity: number;
    cicdScore: number;
  }>;
  lowestQualityProjects: Array<{
    projectId: string;
    projectName: string;
    team: string;
    qualityScore: number;
    qualityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    codeVelocity: number;
    cicdScore: number;
  }>;
  generatedAt: string;
}

export interface TimelineHealth {
  projectsTracked: number;
  onTrackProjects: number;
  atRiskProjects: number;
  delayedProjects: number;
  timelineHealthPercentage: number;
  criticalPath: Array<{
    projectId: string;
    projectName: string;
    team: string;
    startDate: string;
    targetDate: string;
    percentComplete: number;
    daysRemaining: number;
    status: 'on_track' | 'at_risk' | 'delayed';
    riskScore: number;
    velocityIndicator: 'strong' | 'nominal' | 'weak';
  }>;
  earlyWarnings: Array<{
    projectName: string;
    daysRemaining: number;
    percentComplete: number;
    reason: string;
  }>;
  generatedAt: string;
}

export interface DependencyMap {
  projectsTracked: number;
  dependencyLinks: number;
  blockedProjects: number;
  criticalBlockers: number;
  atRiskDependencies: Array<{
    sourceProjectId: string;
    sourceProjectName: string;
    sourceTeam: string;
    targetProjectId: string;
    targetProjectName: string;
    targetTeam: string;
    blockerRiskScore: number;
    blockerRiskBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    blockerRiskTier: 'low' | 'medium' | 'high' | 'critical';
    dependencyType: string;
    blocked: boolean;
  }>;
  generatedAt: string;
}

export interface ReleaseReadiness {
  projectsTracked: number;
  portfolioReadinessScore: number;
  releaseCandidates: number;
  blockedReleases: number;
  readinessLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  checklistCompletion: {
    qaGate: number;
    ciStability: number;
    deliveryPredictability: number;
  };
  projects: Array<{
    projectId: string;
    projectName: string;
    team: string;
    readinessScore: number;
    releaseWindow: 'next_90_days' | 'later';
    blockers: string[];
  }>;
  generatedAt: string;
}

export interface BudgetHealth {
  projectsTracked: number;
  totalPlannedBudget: number;
  totalProjectedSpend: number;
  totalVariance: number;
  totalVariancePercentage: number;
  budgetHealthStatus: 'healthy' | 'watch' | 'over_budget';
  overBudgetProjects: number;
  watchProjects: number;
  topOverruns: Array<{
    projectId: string;
    projectName: string;
    team: string;
    plannedBudget: number;
    projectedSpend: number;
    variance: number;
    variancePercentage: number;
    riskScore: number;
    budgetStatus: 'healthy' | 'watch' | 'over_budget';
  }>;
  generatedAt: string;
}

export interface RecommendationAdoption {
  projectsTracked: number;
  totalRecommendations: number;
  activeRecommendations: number;
  highPriorityRecommendations: number;
  averageConfidence: number;
  estimatedAdoptionRate: number;
  adoptionRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  topOwners: Array<{
    ownerRole: string;
    recommendationCount: number;
  }>;
  topRecommendations: Array<{
    id: string;
    projectId: string;
    projectName: string;
    team: string;
    title: string;
    priority: 'P1' | 'P2' | 'P3';
    ownerRole: string;
    confidence: number;
    status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';
  }>;
  generatedAt: string;
}

export interface OwnerWorkload {
  projectsTracked: number;
  ownersTracked: number;
  overloadedOwners: number;
  highestOwnerLoad: number;
  averageRecommendationsPerOwner: number;
  workloadRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  topOwners: Array<{
    ownerRole: string;
    recommendationCount: number;
    highPriorityCount: number;
    projectCount: number;
    averageConfidence: number;
    workloadRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  generatedAt: string;
}

export interface DashboardMetricsSnapshot {
  teamCapacity: TeamCapacityMetrics;
  qualitySnapshot: QualitySnapshot;
  timelineHealth: TimelineHealth;
  dependencyMap: DependencyMap;
  releaseReadiness: ReleaseReadiness;
  budgetHealth: BudgetHealth;
  recommendationAdoption: RecommendationAdoption;
  ownerWorkload: OwnerWorkload;
  generatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class DashboardMetricsService {
  private readonly METRICS_BASE = '/api/projects/metrics';

  constructor(private http: HttpClient) {}

  private toParams(filters?: { portfolioId?: string }): HttpParams {
    let params = new HttpParams();
    if (filters?.portfolioId) {
      params = params.set('portfolioId', filters.portfolioId);
    }
    return params;
  }

  getDashboardMetrics(filters?: { portfolioId?: string }): Observable<DashboardMetricsSnapshot> {
    return this.http.get<DashboardMetricsSnapshot>(`${this.METRICS_BASE}/dashboard`, {
      params: this.toParams(filters),
    });
  }

  getTeamCapacity(filters?: { portfolioId?: string }): Observable<TeamCapacityMetrics> {
    return this.http.get<TeamCapacityMetrics>(`${this.METRICS_BASE}/team-capacity`, {
      params: this.toParams(filters),
    });
  }

  getQualitySnapshot(filters?: { portfolioId?: string }): Observable<QualitySnapshot> {
    return this.http.get<QualitySnapshot>(`${this.METRICS_BASE}/quality-snapshot`, {
      params: this.toParams(filters),
    });
  }

  getTimelineHealth(filters?: { portfolioId?: string }): Observable<TimelineHealth> {
    return this.http.get<TimelineHealth>(`${this.METRICS_BASE}/timeline-health`, {
      params: this.toParams(filters),
    });
  }

  getDependencyMap(filters?: { portfolioId?: string }): Observable<DependencyMap> {
    return this.http.get<DependencyMap>(`${this.METRICS_BASE}/dependency-map`, {
      params: this.toParams(filters),
    });
  }

  getReleaseReadiness(filters?: { portfolioId?: string }): Observable<ReleaseReadiness> {
    return this.http.get<ReleaseReadiness>(`${this.METRICS_BASE}/release-readiness`, {
      params: this.toParams(filters),
    });
  }

  getBudgetHealth(filters?: { portfolioId?: string }): Observable<BudgetHealth> {
    return this.http.get<BudgetHealth>(`${this.METRICS_BASE}/budget-health`, {
      params: this.toParams(filters),
    });
  }

  getRecommendationAdoption(filters?: { portfolioId?: string }): Observable<RecommendationAdoption> {
    return this.http.get<RecommendationAdoption>(`${this.METRICS_BASE}/recommendation-adoption`, {
      params: this.toParams(filters),
    });
  }

  getOwnerWorkload(filters?: { portfolioId?: string }): Observable<OwnerWorkload> {
    return this.http.get<OwnerWorkload>(`${this.METRICS_BASE}/owner-workload`, {
      params: this.toParams(filters),
    });
  }
}
