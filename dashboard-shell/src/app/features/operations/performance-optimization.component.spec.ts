import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { PerformanceService } from '../../shared/services/performance.service';
import { PerformanceOptimizationComponent } from './performance-optimization.component';

describe('PerformanceOptimizationComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let performanceServiceSpy: jasmine.SpyObj<PerformanceService>;
  let userSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    userSubject = new BehaviorSubject({ id: 'admin-1', role: 'admin', permissions: ['audit:read'] });
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasRole'], {
      user$: userSubject.asObservable(),
    });
    performanceServiceSpy = jasmine.createSpyObj<PerformanceService>('PerformanceService', ['getSloSummary']);

    authServiceSpy.hasRole.and.callFake((role: string | string[]) => {
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(userSubject.value.role);
    });
    performanceServiceSpy.getSloSummary.and.returnValue(of({
      generatedAt: new Date().toISOString(),
      api: {
        targetP95Ms: 250,
        overall: { count: 3, minMs: 10, avgMs: 30, p50Ms: 20, p95Ms: 80, maxMs: 80, withinTarget: true },
        byEndpoint: [{ method: 'GET', path: '/api/projects', count: 3, minMs: 10, avgMs: 30, p50Ms: 20, p95Ms: 80, maxMs: 80, withinTarget: true }],
      },
      dashboard: {
        targetP95Ms: 1500,
        overall: { count: 2, minMs: 300, avgMs: 450, p50Ms: 300, p95Ms: 600, maxMs: 600, withinTarget: true },
        byRoute: [{ route: '/dashboard', count: 2, minMs: 300, avgMs: 450, p50Ms: 300, p95Ms: 600, maxMs: 600, withinTarget: true }],
      },
      overall: {
        apiWithinTarget: true,
        dashboardWithinTarget: true,
      },
    }));

    await TestBed.configureTestingModule({
      imports: [PerformanceOptimizationComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: PerformanceService, useValue: performanceServiceSpy },
      ],
    }).compileComponents();
  });

  it('renders SLO summary for admins', () => {
    const fixture = TestBed.createComponent(PerformanceOptimizationComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(performanceServiceSpy.getSloSummary).toHaveBeenCalled();
    expect(compiled.textContent).toContain('Performance and Scale');
    expect(compiled.textContent).toContain('API p95');
    expect(compiled.textContent).toContain('Dashboard p95');
    expect(compiled.textContent).toContain('/api/projects');
  });

  it('shows access denied for non-admin users', () => {
    userSubject.next({ id: 'manager-1', role: 'delivery_manager', permissions: [] });

    const fixture = TestBed.createComponent(PerformanceOptimizationComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(performanceServiceSpy.getSloSummary).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('Access denied');
  });
});