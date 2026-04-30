import { TestBed } from '@angular/core/testing';
import { RiskScoreCardComponent } from './risk-score-card.component';
import { RiskService } from '../services/risk.service';

describe('RiskScoreCardComponent', () => {
  let riskServiceSpy: jasmine.SpyObj<RiskService>;

  const baseScore = {
    projectId: 'p1',
    projectName: 'Alpha Platform',
    score: 72,
    band: 'HIGH' as const,
    signals: { codeVelocity: 70, quality: 65, cicd: 80, jiraVelocity: 75 },
    lastUpdated: new Date().toISOString(),
  };

  beforeEach(async () => {
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', [
      'getBandColor',
      'getBandBackgroundColor',
    ]);
    riskServiceSpy.getBandColor.and.callFake((band: string) => {
      const m: Record<string, string> = { LOW: '#2e7d32', MEDIUM: '#f9a825', HIGH: '#f57c00', CRITICAL: '#ba1a1a' };
      return m[band] || '#565e74';
    });
    riskServiceSpy.getBandBackgroundColor.and.callFake((band: string) => {
      const m: Record<string, string> = { LOW: '#e8f5e9', MEDIUM: '#fff8e1', HIGH: '#ffe8cc', CRITICAL: '#ffebee' };
      return m[band] || '#f0ecf9';
    });

    await TestBed.configureTestingModule({
      imports: [RiskScoreCardComponent],
      providers: [{ provide: RiskService, useValue: riskServiceSpy }],
    }).compileComponents();
  });

  it('should render project name, band, and score', () => {
    const fixture = TestBed.createComponent(RiskScoreCardComponent);
    fixture.componentInstance.riskScore = baseScore;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Alpha Platform');
    expect(el.textContent).toContain('HIGH');
    expect(el.textContent).toContain('72');
  });

  it('should NOT render trend indicator when trendDirection is null', () => {
    const fixture = TestBed.createComponent(RiskScoreCardComponent);
    fixture.componentInstance.riskScore = baseScore;
    fixture.componentInstance.trendDirection = null;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.trend-indicator')).toBeNull();
  });

  it('should NOT render trend indicator for insufficient_data', () => {
    const fixture = TestBed.createComponent(RiskScoreCardComponent);
    fixture.componentInstance.riskScore = baseScore;
    fixture.componentInstance.trendDirection = 'insufficient_data';
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.trend-indicator')).toBeNull();
  });

  it('should render worsening trend badge with ↑ arrow', () => {
    const fixture = TestBed.createComponent(RiskScoreCardComponent);
    fixture.componentInstance.riskScore = baseScore;
    fixture.componentInstance.trendDirection = 'worsening';
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.trend-worsening') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('↑');
    expect(badge.textContent).toContain('Worsening');
  });

  it('should render improving trend badge with ↓ arrow', () => {
    const fixture = TestBed.createComponent(RiskScoreCardComponent);
    fixture.componentInstance.riskScore = baseScore;
    fixture.componentInstance.trendDirection = 'improving';
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.trend-improving') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('↓');
    expect(badge.textContent).toContain('Improving');
  });

  it('should render stable trend badge with → arrow', () => {
    const fixture = TestBed.createComponent(RiskScoreCardComponent);
    fixture.componentInstance.riskScore = baseScore;
    fixture.componentInstance.trendDirection = 'stable';
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.trend-stable') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('→');
    expect(badge.textContent).toContain('Stable');
  });
});
