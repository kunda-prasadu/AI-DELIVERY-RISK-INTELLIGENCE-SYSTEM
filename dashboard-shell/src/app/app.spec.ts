import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './shared/services/auth.service';
import { PerformanceService } from './shared/services/performance.service';
import { RiskService } from './shared/services/risk.service';

describe('App', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let performanceServiceSpy: jasmine.SpyObj<PerformanceService>;
  let riskServiceSpy: jasmine.SpyObj<RiskService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['initializeSession']);
    performanceServiceSpy = jasmine.createSpyObj<PerformanceService>('PerformanceService', ['recordDashboardRender']);
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', ['refreshRiskScores']);

    authServiceSpy.initializeSession.and.returnValue(of({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      permissions: [],
    } as any));
    performanceServiceSpy.recordDashboardRender.and.returnValue(of({ accepted: true }));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: PerformanceService, useValue: performanceServiceSpy },
        { provide: RiskService, useValue: riskServiceSpy },
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should expose product title', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.title).toBe('RiskIntel Dashboard');
  });
});
