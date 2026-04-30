import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RiskComponent } from './risk.component';
import { RiskService } from '../../shared/services/risk.service';

describe('RiskComponent', () => {
  let riskServiceSpy: jasmine.SpyObj<RiskService>;

  beforeEach(async () => {
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', [
      'refreshRiskScores',
      'getPortfolioAnomalies',
      'getBandColor',
      'getBandBackgroundColor',
      'getRiskScores',
    ]);
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
    riskServiceSpy.getRiskScores.and.returnValue(of([]));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [RiskComponent],
      providers: [{ provide: RiskService, useValue: riskServiceSpy }],
    }).compileComponents();
  });

  it('should render sorted risk scores and summary counts', () => {
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p-low',
          projectName: 'Low Program',
          score: 22,
          band: 'LOW',
          signals: { codeVelocity: 20, quality: 25, cicd: 20, jiraVelocity: 23 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p-critical',
          projectName: 'Critical Program',
          score: 92,
          band: 'CRITICAL',
          signals: { codeVelocity: 90, quality: 95, cicd: 89, jiraVelocity: 94 },
          lastUpdated: new Date().toISOString(),
        },
      ])
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p-critical',
          severity: 'CRITICAL',
          anomalyScore: 95,
          trend: 'regression',
          reasons: ['critical trend is regressing compared to previous snapshot'],
          metrics: {
            totalEvents: 7,
            severityCounts: { low: 0, medium: 1, high: 2, critical: 4 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );

    const fixture = TestBed.createComponent(RiskComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.riskScores[0].projectName).toBe('Critical Program');
    expect(component.getBandCount('CRITICAL')).toBe(1);
    expect(compiled.textContent).toContain('Critical Program');
    expect(compiled.textContent).toContain('Portfolio Risk Heatmap');
    expect(compiled.textContent).toContain('Detailed Risk Scorecards');
    expect(compiled.textContent).toContain('Anomaly Drilldown');
  });

  it('should show retry state when risk service fails', () => {
    riskServiceSpy.refreshRiskScores.and.returnValue(throwError(() => new Error('risk fetch failed')));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([]));

    const fixture = TestBed.createComponent(RiskComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.errorMessage).toContain('Unable to load risk scores');
    expect(compiled.textContent).toContain('Try Again');
  });
});
