import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { ProjectsService } from '../../shared/services/projects.service';
import { RiskService } from '../../shared/services/risk.service';
import { AlertService } from '../../shared/services/alert.service';

describe('DashboardComponent', () => {
  let projectsServiceSpy: jasmine.SpyObj<ProjectsService>;
  let riskServiceSpy: jasmine.SpyObj<RiskService>;
  let alertServiceSpy: jasmine.SpyObj<AlertService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    projectsServiceSpy = jasmine.createSpyObj<ProjectsService>('ProjectsService', ['getProjects']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    alertServiceSpy = jasmine.createSpyObj<AlertService>('AlertService', ['getPortfolioAlerts']);
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

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceSpy },
        { provide: RiskService, useValue: riskServiceSpy },
        { provide: AlertService, useValue: alertServiceSpy },
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
    fixture.componentInstance.projectTrendNextRetryAt = { p1: Date.now() + 2_000 };

    expect(fixture.componentInstance.isRetryDisabled('p1')).toBeTrue();
    expect(fixture.componentInstance.getRetryHint('p1')).toContain('Retry available in');
  });

  it('should report retry limit hint when max attempts reached', () => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.componentInstance.projectTrendLoading = { p1: false };
    fixture.componentInstance.projectTrendRetryAttempts = { p1: 3 };
    fixture.componentInstance.projectTrendNextRetryAt = { p1: 0 };

    expect(fixture.componentInstance.isRetryDisabled('p1')).toBeTrue();
    expect(fixture.componentInstance.getRetryHint('p1')).toContain('Retry limit reached');
  });
});
