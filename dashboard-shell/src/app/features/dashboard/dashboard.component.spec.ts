import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
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
        return of({ trend: 'worsening' } as any);
      }
      if (projectId === 'p2') {
        return of({ trend: 'stable' } as any);
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
    expect(compiled.textContent).toContain('Project One');
    expect(compiled.textContent).toContain('Portfolio Risk Heatmap');
    expect(compiled.textContent).toContain('Risk Scorecards');
    expect(compiled.textContent).toContain('Worsening');
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
});
