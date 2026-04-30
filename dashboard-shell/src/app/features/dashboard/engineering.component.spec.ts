import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EngineeringComponent } from './engineering.component';
import { ProjectsService } from '../../shared/services/projects.service';
import { RiskService } from '../../shared/services/risk.service';

describe('EngineeringComponent', () => {
  let projectsServiceSpy: jasmine.SpyObj<ProjectsService>;
  let riskServiceSpy: jasmine.SpyObj<RiskService>;

  beforeEach(async () => {
    projectsServiceSpy = jasmine.createSpyObj<ProjectsService>('ProjectsService', ['getProjects']);
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', ['refreshRiskScores', 'getPortfolioAnomalies']);

    await TestBed.configureTestingModule({
      imports: [EngineeringComponent],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceSpy },
        { provide: RiskService, useValue: riskServiceSpy },
      ],
    }).compileComponents();
  });

  it('should compute engineering metrics and render hotspot sections', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [
          { id: 'p1', name: 'Payments Gateway', team: 'Core Platform', description: '', status: 'active' },
          { id: 'p2', name: 'IAM Platform', team: 'Identity', description: '', status: 'active' },
          { id: 'p3', name: 'Data Platform', team: 'Data', description: '', status: 'active' },
        ],
        total: 3,
      } as any)
    );

    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Payments Gateway',
          score: 88,
          band: 'CRITICAL',
          signals: { codeVelocity: 73, quality: 58, cicd: 52, jiraVelocity: 70 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p2',
          projectName: 'IAM Platform',
          score: 61,
          band: 'HIGH',
          signals: { codeVelocity: 62, quality: 66, cicd: 59, jiraVelocity: 68 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p3',
          projectName: 'Data Platform',
          score: 29,
          band: 'LOW',
          signals: { codeVelocity: 44, quality: 39, cicd: 48, jiraVelocity: 55 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );

    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p1',
          severity: 'CRITICAL',
          anomalyScore: 94,
          trend: 'regression',
          reasons: ['Critical trend is regressing compared to previous snapshot'],
          metrics: {
            totalEvents: 16,
            severityCounts: { low: 2, medium: 4, high: 5, critical: 5 },
            latestEventAt: new Date().toISOString(),
          },
        },
        {
          projectId: 'p2',
          severity: 'HIGH',
          anomalyScore: 80,
          trend: 'watch',
          reasons: ['High severity events are rising'],
          metrics: {
            totalEvents: 11,
            severityCounts: { low: 2, medium: 3, high: 4, critical: 2 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.hotspots.length).toBe(3);
    expect(component.highRiskCount).toBe(2);
    expect(component.regressionCount).toBe(1);
    expect(component.criticalEventCount).toBe(7);
    expect(component.deliveryPressure).toBe(59);

    expect(compiled.textContent).toContain('Top Hotspot Repositories');
    expect(compiled.textContent).toContain('Reliability Watchlist');
    expect(compiled.textContent).toContain('Quality Drift Radar');
    expect(compiled.textContent).toContain('Payments Gateway');
  });

  it('should order hotspots by weighted pressure score', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [
          { id: 'p1', name: 'A', team: 'Team A', description: '', status: 'active' },
          { id: 'p2', name: 'B', team: 'Team B', description: '', status: 'active' },
        ],
        total: 2,
      } as any)
    );

    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'A',
          score: 55,
          band: 'HIGH',
          signals: { codeVelocity: 60, quality: 49, cicd: 60, jiraVelocity: 58 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p2',
          projectName: 'B',
          score: 48,
          band: 'LOW',
          signals: { codeVelocity: 40, quality: 35, cicd: 42, jiraVelocity: 41 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );

    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p1',
          severity: 'HIGH',
          anomalyScore: 71,
          trend: 'watch',
          reasons: ['High severity pressure'],
          metrics: {
            totalEvents: 7,
            severityCounts: { low: 1, medium: 2, high: 3, critical: 1 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.hotspots[0].projectId).toBe('p1');
    expect(component.hotspots[1].projectId).toBe('p2');
  });

  it('should fall back to empty state when services fail', () => {
    projectsServiceSpy.getProjects.and.returnValue(throwError(() => new Error('projects failure')));
    riskServiceSpy.refreshRiskScores.and.returnValue(throwError(() => new Error('risk failure')));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(throwError(() => new Error('anomaly failure')));

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.loading).toBeFalse();
    expect(component.hotspots.length).toBe(0);
    expect(component.deliveryPressure).toBe(0);
    expect(compiled.textContent).toContain('No engineering insights are available yet.');
  });
});
