import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../shared/services/auth.service';
import { ProjectsService } from '../../shared/services/projects.service';
import { RiskService } from '../../shared/services/risk.service';
import { AlertService } from '../../shared/services/alert.service';
import { ReportingService } from '../../shared/services/reporting.service';
import { ForecastService } from '../../shared/services/forecast.service';
import { DashboardMetricsService } from '../../shared/services/dashboard-metrics.service';

describe('DashboardComponent', () => {
  let projectsServiceSpy: jasmine.SpyObj<ProjectsService>;
  let riskServiceSpy: jasmine.SpyObj<RiskService>;
  let alertServiceSpy: jasmine.SpyObj<AlertService>;
  let reportingServiceSpy: jasmine.SpyObj<ReportingService>;
  let forecastServiceSpy: jasmine.SpyObj<ForecastService>;
  let dashboardMetricsServiceSpy: jasmine.SpyObj<DashboardMetricsService>;
  let routerSpy: jasmine.SpyObj<Router>;
  const authServiceStub = {
    user$: of(null),
  };

  beforeEach(async () => {
    projectsServiceSpy = jasmine.createSpyObj<ProjectsService>('ProjectsService', ['getProjects']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    alertServiceSpy = jasmine.createSpyObj<AlertService>('AlertService', ['getPortfolioAlerts']);
    reportingServiceSpy = jasmine.createSpyObj<ReportingService>('ReportingService', ['listReports']);
    forecastServiceSpy = jasmine.createSpyObj<ForecastService>('ForecastService', ['list']);
    dashboardMetricsServiceSpy = jasmine.createSpyObj<DashboardMetricsService>('DashboardMetricsService', [
      'getDashboardMetrics',
      'getTeamCapacity',
      'getQualitySnapshot',
      'getTimelineHealth',
      'getDependencyMap',
      'getReleaseReadiness',
      'getBudgetHealth',
      'getRecommendationAdoption',
      'getOwnerWorkload',
    ]);
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', [
      'refreshRiskScores',
      'getPortfolioAnomalies',
      'getProjectRiskTrend',
      'getBandColor',
      'getBandBackgroundColor',
    ]);
    riskServiceSpy.getProjectRiskTrend.and.returnValue(of(null));
    riskServiceSpy.getBandColor.and.callFake((band: string) => {
      const colors: Record<string, string> = {
        LOW: '#2e7d32',
        MEDIUM: '#f9a825',
        HIGH: '#f57c00',
        CRITICAL: '#ba1a1a',
      };
      return colors[band] || '#565e74';
    });
    riskServiceSpy.getBandBackgroundColor.and.callFake((band: string) => {
      const colors: Record<string, string> = {
        LOW: '#e8f5e9',
        MEDIUM: '#fff8e1',
        HIGH: '#ffe8cc',
        CRITICAL: '#ffebee',
      };
      return colors[band] || '#f0ecf9';
    });
    reportingServiceSpy.listReports.and.returnValue(of({ reports: [], total: 0 }));
    forecastServiceSpy.list.and.returnValue(of({ forecasts: [], total: 0 }));
    dashboardMetricsServiceSpy.getDashboardMetrics.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getTeamCapacity.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getQualitySnapshot.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getTimelineHealth.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getDependencyMap.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getReleaseReadiness.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getBudgetHealth.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getRecommendationAdoption.and.returnValue(of(null as any));
    dashboardMetricsServiceSpy.getOwnerWorkload.and.returnValue(of(null as any));
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: AuthService, useValue: authServiceStub },
        { provide: ProjectsService, useValue: projectsServiceSpy },
        { provide: RiskService, useValue: riskServiceSpy },
        { provide: AlertService, useValue: alertServiceSpy },
        { provide: ReportingService, useValue: reportingServiceSpy },
        { provide: ForecastService, useValue: forecastServiceSpy },
        { provide: DashboardMetricsService, useValue: dashboardMetricsServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
  });

  it('should compute and render portfolio metrics from live data', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({ projects: [{ id: 'p1' } as any, { id: 'p2' } as any], total: 2 })
    );
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Project One',
          score: 82,
          band: 'CRITICAL',
          signals: { codeVelocity: 80, quality: 82, cicd: 85, jiraVelocity: 81 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p2',
          projectName: 'Project Two',
          score: 30,
          band: 'LOW',
          signals: { codeVelocity: 20, quality: 40, cicd: 30, jiraVelocity: 30 },
          lastUpdated: new Date().toISOString(),
        },
      ])
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p1',
          severity: 'CRITICAL',
          anomalyScore: 92,
          trend: 'regression',
          reasons: ['critical trend is regressing compared to previous snapshot'],
          metrics: {
            totalEvents: 8,
            severityCounts: { low: 0, medium: 1, high: 2, critical: 5 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );
    riskServiceSpy.getProjectRiskTrend.and.callFake((projectId: string) => {
      if (projectId === 'p1') {
        return of({
          trend: 'worsening',
          snapshots: [
            { snapshotAt: '2026-04-28T04:22:00.000Z', riskScore: 82, band: 'CRITICAL', criticalCount: 4, totalEvents: 7 },
          ],
        } as any);
      }
      if (projectId === 'p2') {
        return of({
          trend: 'stable',
          snapshots: [
            { snapshotAt: new Date().toISOString(), riskScore: 30, band: 'LOW', criticalCount: 0, totalEvents: 2 },
          ],
        } as any);
      }
      return of(null);
    });
    alertServiceSpy.getPortfolioAlerts.and.returnValue(
      of({
        totalActive: 1,
        alerts: [
          {
            projectId: 'p1',
            active: true,
            severity: 'CRITICAL',
            breachCount: 3,
            breaches: [
              {
                rule: 'RISK_SCORE',
                message: 'Risk score exceeded threshold.',
                actual: 82,
                threshold: 70,
              },
            ],
            evaluatedAt: new Date().toISOString(),
          },
        ],
      })
    );
    reportingServiceSpy.listReports.and.returnValue(
      of({
        reports: [
          {
            reportId: 'rpt-1',
            reportType: 'executive-summary',
            requestedBy: 'exec-user',
            generatedAt: new Date().toISOString(),
            sections: {
              executiveSummary: {
                portfolioHealth: { totalProjects: 2, atRisk: 1, onTrack: 1, ragBreakdown: { RED: 1, AMBER: 0, GREEN: 1 } },
                averageRiskScore: 56,
                overallRag: 'RED',
                openInsights: 4,
                openRecommendations: 3,
                anomalyCount: 1,
              },
              topRisks: [
                { projectId: 'p1', projectName: 'Project One', riskScore: 82, rag: 'RED', status: 'active' },
              ],
            },
          },
        ],
        total: 1,
      })
    );
    forecastServiceSpy.list.and.returnValue(
      of({
        forecasts: [
          {
            forecastId: 'fc-1',
            forecastType: 'PORTFOLIO',
            totalProjects: 2,
            forecastedProjects: 2,
            completionForecasts: [
              {
                forecastType: 'COMPLETION',
                projectId: 'p1',
                projectName: 'Project One',
                remainingPoints: 40,
                avgVelocity: 20,
                sprintVelocities: [18, 21, 20, 21],
                velocityTrend: { slope: 0.5, r2: 0.7 },
                estimatedSprintsRemaining: 2,
                estimatedCompletionDate: '2026-05-28',
                confidence: 'HIGH',
              },
            ],
            riskTrends: [],
            summary: { worseningCount: 1, improvingCount: 0, stableCount: 1, atRiskCount: 1 },
            generatedAt: new Date().toISOString(),
          },
        ],
        total: 1,
      })
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.metrics.activeProjects).toBe(2);
    expect(component.metrics.openHighRisks).toBe(1);
    expect(component.metrics.avgProbability).toBe(56);
    expect(component.projectTrendDirections['p1']).toBe('worsening');
    expect(component.projectTrendUpdatedAt['p1']).toBe('2026-04-28T04:22:00.000Z');
    expect(component.projectTrendAgeStatus['p1']).toBe('stale');
    expect(component.projectTrendAgeStatus['p2']).toBe('fresh');
    expect(compiled.textContent).toContain('Project One');
    expect(compiled.textContent).toContain('Portfolio Risk Heatmap');
    expect(compiled.textContent).toContain('Risk Scorecards');
    expect(compiled.textContent).toContain('Worsening');
    expect(compiled.textContent).toContain('Stale');
    expect(compiled.textContent).toContain('Anomaly Radar');
    expect(compiled.textContent).toContain('Active Alerts');
    expect(compiled.textContent).toContain('What Needs Attention Now');
    expect(compiled.textContent).toContain('High risk score (82) requires remediation and owner alignment.');
    expect(compiled.textContent).toContain('Executive Snapshot');
    expect(compiled.textContent).toContain('Latest Executive Report');
    expect(compiled.textContent).toContain('Latest Portfolio Forecast');
    expect(compiled.textContent).toContain('2026-05-28');
    expect(compiled.textContent).toContain('Risk score exceeded threshold.');
    expect(compiled.textContent).toContain('Action:');
    expect(compiled.textContent).toContain('Escalate to the delivery and engineering leads within 24 hours');
  });

  it('should show unavailable state when both projects and risks are empty', () => {
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [], total: 0 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.errorMessage).toContain('Dashboard data is unavailable');
    expect(compiled.textContent).toContain('Try Again');
  });

  it('should render Budget Health card when budget data is available', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({ projects: [{ id: 'p1' } as any], total: 1 })
    );
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Project One',
          score: 70,
          band: 'HIGH',
          signals: { codeVelocity: 70, quality: 60, cicd: 55, jiraVelocity: 60 },
          lastUpdated: new Date().toISOString(),
        },
      ])
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([] as any));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));
    dashboardMetricsServiceSpy.getDashboardMetrics.and.returnValue(
      of({
        teamCapacity: null,
        qualitySnapshot: null,
        timelineHealth: null,
        dependencyMap: null,
        releaseReadiness: null,
        budgetHealth: {
          projectsTracked: 5,
          totalPlannedBudget: 3700000,
          totalProjectedSpend: 3839900,
          totalVariance: 139900,
          totalVariancePercentage: 4,
          budgetHealthStatus: 'watch',
          overBudgetProjects: 1,
          watchProjects: 1,
          topOverruns: [
            {
              projectId: 'proj-003',
              projectName: 'Data Platform Migration',
              team: 'data',
              plannedBudget: 900000,
              projectedSpend: 1255500,
              variance: 355500,
              variancePercentage: 40,
              riskScore: 70,
              budgetStatus: 'over_budget',
            },
          ],
          generatedAt: new Date().toISOString(),
        },
        recommendationAdoption: {
          projectsTracked: 5,
          totalRecommendations: 14,
          activeRecommendations: 11,
          highPriorityRecommendations: 3,
          averageConfidence: 79,
          estimatedAdoptionRate: 74,
          adoptionRiskLevel: 'MEDIUM',
          topOwners: [{ ownerRole: 'Program Manager', recommendationCount: 4 }],
          topRecommendations: [
            {
              id: 'REC-SUMMARY-1',
              projectId: 'proj-003',
              projectName: 'Data Platform Migration',
              team: 'data',
              title: 'Stabilize release train handoffs',
              priority: 'P1',
              ownerRole: 'Program Manager',
              confidence: 91,
              status: 'OPEN',
            },
          ],
          generatedAt: new Date().toISOString(),
        },
        ownerWorkload: {
          projectsTracked: 5,
          ownersTracked: 4,
          overloadedOwners: 1,
          highestOwnerLoad: 6,
          averageRecommendationsPerOwner: 3.5,
          workloadRiskLevel: 'HIGH',
          topOwners: [
            {
              ownerRole: 'Program Manager',
              recommendationCount: 6,
              highPriorityCount: 3,
              projectCount: 3,
              averageConfidence: 88,
              workloadRiskLevel: 'HIGH',
            },
          ],
          generatedAt: new Date().toISOString(),
        },
        generatedAt: new Date().toISOString(),
      } as any)
    );

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Budget Health');
    expect(compiled.textContent).toContain('Portfolio Variance');
    expect(compiled.textContent).toContain('Top Budget Overruns');
    expect(compiled.textContent).toContain('Data Platform Migration');
    expect(compiled.textContent).toContain('Live Portfolio Snapshot');
    expect(compiled.textContent).toContain('Derived from current live dashboard metrics');
    expect(compiled.textContent).toContain('What Needs Attention Now');
    expect(compiled.textContent).toContain('Open Risk Details');
    expect(compiled.textContent).toContain('Recommendation Adoption');
    expect(compiled.textContent).toContain('Estimated Adoption Rate');
    expect(compiled.textContent).toContain('Top Recommendations Requiring Follow-up');
    expect(compiled.textContent).toContain('Stabilize release train handoffs');
    expect(compiled.textContent).toContain('Owner Workload');
    expect(compiled.textContent).toContain('Overloaded Owners');
    expect(compiled.textContent).toContain('Peak Recommendation Load');
  });

  it('should navigate to anomaly drilldown from dashboard', () => {
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [{ id: 'p1' } as any], total: 1 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    fixture.componentInstance.openAnomalyDetail('p1');

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/risk/anomalies', 'p1']);
  });

  it('should navigate to anomaly detail when action hint is clicked', () => {
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [{ id: 'p-crit' } as any], total: 1 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p-crit',
          severity: 'CRITICAL',
          anomalyScore: 90,
          trend: 'regression',
          reasons: ['critical regression'],
          metrics: {
            totalEvents: 6,
            severityCounts: { low: 0, medium: 0, high: 1, critical: 5 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const hint = fixture.nativeElement.querySelector('.anomaly-action-hint') as HTMLElement;
    hint.click();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/risk/anomalies', 'p-crit']);
  });

  it('should compute top anomaly action hint', () => {
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [], total: 0 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    const action = fixture.componentInstance.getTopAnomalyAction({
      projectId: 'p1',
      severity: 'LOW',
      anomalyScore: 18,
      trend: 'stable',
      reasons: ['signals are stable'],
      metrics: {
        totalEvents: 2,
        severityCounts: { low: 2, medium: 0, high: 0, critical: 0 },
        latestEventAt: new Date().toISOString(),
      },
    });

    expect(action).toContain('Track in the weekly risk review');
  });

  it('should render insufficient-data trend copy on scorecards when trend snapshots are unavailable', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({ projects: [{ id: 'p1' } as any], total: 1 })
    );
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Project One',
          score: 82,
          band: 'CRITICAL',
          signals: { codeVelocity: 80, quality: 82, cicd: 85, jiraVelocity: 81 },
          lastUpdated: new Date().toISOString(),
        },
      ])
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    riskServiceSpy.getProjectRiskTrend.and.returnValue(of({ trend: 'insufficient_data' } as any));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Trend unavailable: insufficient snapshots');
  });

  it('should track loading state while scorecard trends are being fetched', () => {
    const trendSubject = new Subject<any>();
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [{ id: 'p1' } as any], total: 1 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Project One',
          score: 78,
          band: 'HIGH',
          signals: { codeVelocity: 75, quality: 70, cicd: 80, jiraVelocity: 74 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    riskServiceSpy.getProjectRiskTrend.and.returnValue(trendSubject.asObservable());
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.projectTrendLoading['p1']).toBeTrue();

    trendSubject.next({ trend: 'stable' });
    trendSubject.complete();
    fixture.detectChanges();

    expect(fixture.componentInstance.projectTrendLoading['p1']).toBeFalse();
  });

  it('should render fetch-failed trend copy when trend request errors', () => {
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [{ id: 'p1' } as any], total: 1 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Project One',
          score: 70,
          band: 'HIGH',
          signals: { codeVelocity: 70, quality: 70, cicd: 70, jiraVelocity: 70 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    riskServiceSpy.getProjectRiskTrend.and.returnValue(throwError(() => new Error('trend route failed')));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.projectTrendDirections['p1']).toBe('fetch_failed');
    expect(compiled.textContent).toContain('Trend unavailable: fetch failed');
  });

  it('should retry a single project trend after fetch_failed state', () => {
    let attempt = 0;
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [{ id: 'p1' } as any], total: 1 }));
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Project One',
          score: 70,
          band: 'HIGH',
          signals: { codeVelocity: 70, quality: 70, cicd: 70, jiraVelocity: 70 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    riskServiceSpy.getProjectRiskTrend.and.callFake(() => {
      attempt += 1;
      if (attempt === 1) {
        return throwError(() => new Error('trend route failed'));
      }
      return of({
        trend: 'stable',
        snapshots: [
          { snapshotAt: new Date().toISOString(), riskScore: 70, band: 'HIGH', criticalCount: 1, totalEvents: 4 },
        ],
      } as any);
    });
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.projectTrendDirections['p1']).toBe('fetch_failed');

    fixture.componentInstance.retryProjectTrend('p1');
    fixture.detectChanges();

    expect(fixture.componentInstance.projectTrendDirections['p1']).toBe('stable');
  });

  it('should not retry when project is in cooldown window', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.projectTrendDirections = { p1: 'fetch_failed' } as any;
    fixture.componentInstance.projectTrendLoading = { p1: false };
    fixture.componentInstance.projectTrendRetryAttempts = { p1: 1 };
    fixture.componentInstance.projectTrendNextRetryAt = { p1: Date.now() + 60_000 };

    fixture.componentInstance.retryProjectTrend('p1');

    expect(riskServiceSpy.getProjectRiskTrend).not.toHaveBeenCalled();
  });

  it('should stop retrying after max retry attempts are reached', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.projectTrendDirections = { p1: 'fetch_failed' } as any;
    fixture.componentInstance.projectTrendLoading = { p1: false };
    fixture.componentInstance.projectTrendRetryAttempts = { p1: 3 };
    fixture.componentInstance.projectTrendNextRetryAt = { p1: 0 };

    fixture.componentInstance.retryProjectTrend('p1');

    expect(riskServiceSpy.getProjectRiskTrend).not.toHaveBeenCalled();
  });

  it('should report retry disabled and cooldown hint while waiting for next retry window', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.projectTrendLoading = { p1: false };
    fixture.componentInstance.projectTrendRetryAttempts = { p1: 1 };
    fixture.componentInstance.retryNow = 1_000;
    fixture.componentInstance.projectTrendNextRetryAt = { p1: 3_000 };

    expect(fixture.componentInstance.isRetryDisabled('p1')).toBeTrue();
    expect(fixture.componentInstance.getRetryHint('p1')).toContain('Retry available in 2s');

    fixture.componentInstance.retryNow = 2_100;
    expect(fixture.componentInstance.getRetryHint('p1')).toContain('Retry available in 1s');
  });

  it('should report retry limit hint when max attempts reached', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.projectTrendLoading = { p1: false };
    fixture.componentInstance.projectTrendRetryAttempts = { p1: 3 };
    fixture.componentInstance.projectTrendNextRetryAt = { p1: 0 };

    expect(fixture.componentInstance.isRetryDisabled('p1')).toBeTrue();
    expect(fixture.componentInstance.getRetryHint('p1')).toContain('Retry limit reached');
  });

  it('should reload dashboard with selected portfolio filter', () => {
    projectsServiceSpy.getProjects.and.callFake((filters?: { portfolioId?: string }) => {
      if (filters?.portfolioId === 'pf-fintech') {
        return of({ projects: [{ id: 'p1', portfolioId: 'pf-fintech' } as any], total: 1 });
      }

      return of({
        projects: [
          { id: 'p1', portfolioId: 'pf-fintech', portfolioName: 'FinTech Modernization' } as any,
          { id: 'p2', portfolioId: 'pf-operations', portfolioName: 'Operations Excellence' } as any,
        ],
        total: 2,
      });
    });
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));
    alertServiceSpy.getPortfolioAlerts.and.returnValue(of({ totalActive: 0, alerts: [] }));

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();

    fixture.componentInstance.onPortfolioSelectionChange('pf-fintech');
    fixture.detectChanges();

    expect(projectsServiceSpy.getProjects).toHaveBeenCalledWith({ portfolioId: 'pf-fintech' });
    expect(dashboardMetricsServiceSpy.getDashboardMetrics).toHaveBeenCalledWith({ portfolioId: 'pf-fintech' });
  });
});
