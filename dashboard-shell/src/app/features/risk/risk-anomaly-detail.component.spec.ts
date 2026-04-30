import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { RiskService } from '../../shared/services/risk.service';
import { RiskAnomalyDetailComponent } from './risk-anomaly-detail.component';

describe('RiskAnomalyDetailComponent', () => {
  let riskServiceSpy: jasmine.SpyObj<RiskService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', ['getProjectAnomaly']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

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
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();
  });

  it('should render anomaly details for selected project', () => {
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

    const fixture = TestBed.createComponent(RiskAnomalyDetailComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Project Anomaly Detail');
    expect(compiled.textContent).toContain('p-critical');
    expect(compiled.textContent).toContain('Primary Anomaly Reasons');
  });

  it('should navigate back to risk page', () => {
    riskServiceSpy.getProjectAnomaly.and.returnValue(of(null));

    const fixture = TestBed.createComponent(RiskAnomalyDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.goBack();

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/risk']);
  });
});
