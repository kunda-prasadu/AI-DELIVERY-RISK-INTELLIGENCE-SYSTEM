import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ProjectsService } from '../../shared/services/projects.service';
import { RiskService } from '../../shared/services/risk.service';
import { AlertService } from '../../shared/services/alert.service';
import { RiskAnomalyDetailComponent } from './risk-anomaly-detail.component';

describe('RiskAnomalyDetailComponent', () => {
  let riskServiceSpy: jasmine.SpyObj<RiskService>;
  let projectsServiceSpy: jasmine.SpyObj<ProjectsService>;
  let alertServiceSpy: jasmine.SpyObj<AlertService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', ['getProjectAnomaly', 'getProjectRiskTrend']);
    projectsServiceSpy = jasmine.createSpyObj<ProjectsService>('ProjectsService', ['getProjects']);
    alertServiceSpy = jasmine.createSpyObj<AlertService>('AlertService', ['getProjectAlerts']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [], total: 0 }));
    riskServiceSpy.getProjectRiskTrend.and.returnValue(of(null));
    alertServiceSpy.getProjectAlerts.and.returnValue(of(null));

    await TestBed.configureTestingModule({
      imports: [RiskAnomalyDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId: 'p-critical' }),
            },
          },
        },
        { provide: RiskService, useValue: riskServiceSpy },
        { provide: ProjectsService, useValue: projectsServiceSpy },
        { provide: AlertService, useValue: alertServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
  });

  it('should render anomaly details for selected project', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [{ id: 'p-critical', name: 'Critical Program' } as any],
        total: 1,
      })
    );
    riskServiceSpy.getProjectAnomaly.and.returnValue(
      of({
        projectId: 'p-critical',
        severity: 'CRITICAL',
        anomalyScore: 93,
        trend: 'regression',
        reasons: ['critical trend is regressing compared to previous snapshot'],
        metrics: {
          totalEvents: 11,
          severityCounts: { low: 0, medium: 2, high: 3, critical: 6 },
          latestEventAt: new Date().toISOString(),
        },
      } as any)
    );
    riskServiceSpy.getProjectRiskTrend.and.returnValue(of(null));
    alertServiceSpy.getProjectAlerts.and.returnValue(
      of({
        projectId: 'p-critical',
        active: true,
        severity: 'CRITICAL',
        breachCount: 2,
        breaches: [
          {
            rule: 'CRITICAL_EVENT_COUNT',
            message: 'Critical event count exceeded threshold.',
            actual: 6,
            threshold: 3,
          },
        ],
        evaluatedAt: new Date().toISOString(),
      })
    );

    const fixture = TestBed.createComponent(RiskAnomalyDetailComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project Anomaly Detail');
    expect(compiled.textContent).toContain('Critical Program');
    expect(compiled.textContent).toContain('p-critical');
    expect(compiled.textContent).toContain('Severity Timeline Snapshot');
    expect(compiled.textContent).toContain('Recommended Next Actions');
    expect(compiled.textContent).toContain('Escalate to the delivery and engineering leads within 24 hours');
    expect(compiled.textContent).toContain('Primary Anomaly Reasons');
    expect(compiled.textContent).toContain('Active Threshold Breaches');
    expect(compiled.textContent).toContain('Critical event count exceeded threshold.');
  });

  it('should navigate back to risk page', () => {
    riskServiceSpy.getProjectAnomaly.and.returnValue(of(null));
    riskServiceSpy.getProjectRiskTrend.and.returnValue(of(null));
    alertServiceSpy.getProjectAlerts.and.returnValue(of(null));

    const fixture = TestBed.createComponent(RiskAnomalyDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.goBack();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/risk']);
  });

  it('should render sparkline when risk trend has 2+ snapshots', () => {
    const now = new Date().toISOString();
    riskServiceSpy.getProjectAnomaly.and.returnValue(
      of({
        projectId: 'p-critical',
        severity: 'CRITICAL',
        anomalyScore: 90,
        trend: 'regression',
        reasons: ['regression detected'],
        metrics: {
          totalEvents: 8,
          severityCounts: { low: 0, medium: 1, high: 2, critical: 5 },
          latestEventAt: now,
        },
      } as any)
    );
    riskServiceSpy.getProjectRiskTrend.and.returnValue(
      of({
        projectId: 'p-critical',
        window: 7,
        trend: 'worsening',
        deltaScore: 50,
        snapshots: [
          { snapshotAt: now, riskScore: 25, band: 'MEDIUM', criticalCount: 1, totalEvents: 1 },
          { snapshotAt: now, riskScore: 75, band: 'CRITICAL', criticalCount: 3, totalEvents: 4 },
        ],
      } as any)
    );
    alertServiceSpy.getProjectAlerts.and.returnValue(of(null));

    const fixture = TestBed.createComponent(RiskAnomalyDetailComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('7-Day Risk Score Trend');
    expect(compiled.textContent).toContain('Worsening');
    expect(compiled.textContent).toContain('+50 pts over 2 snapshots');
    expect(compiled.querySelector('svg.sparkline')).toBeTruthy();
    expect(compiled.querySelector('polyline')).toBeTruthy();
  });
});
