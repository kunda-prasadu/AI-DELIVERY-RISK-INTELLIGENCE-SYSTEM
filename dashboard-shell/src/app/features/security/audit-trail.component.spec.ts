import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuditTrailComponent } from './audit-trail.component';
import { AuditService } from '../../shared/services/audit.service';
import { AuthService } from '../../shared/services/auth.service';

describe('AuditTrailComponent', () => {
  let auditServiceSpy: jasmine.SpyObj<AuditService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let userSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    auditServiceSpy = jasmine.createSpyObj<AuditService>('AuditService', ['list']);
    userSubject = new BehaviorSubject({ id: 'u1', role: 'admin', permissions: ['audit:read'] });
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission'], {
      user$: userSubject.asObservable(),
    });
    authServiceSpy.hasPermission.and.callFake((permission: string) => userSubject.value.permissions.includes(permission));
    auditServiceSpy.list.and.returnValue(
      of({
        entries: [
          {
            auditId: 'a1',
            timestamp: new Date().toISOString(),
            actorId: 'u1',
            actorRole: 'admin',
            action: 'auth.login',
            resourceType: 'session',
            resourceId: 'u1',
            outcome: 'SUCCESS',
            ipAddress: '127.0.0.1',
            userAgent: 'Chrome',
            metadata: {},
            previousHash: null,
            hash: 'abcdef1234567890fedcba',
          },
        ],
        total: 1,
        integrity: { valid: true, totalEntries: 1, brokenAt: null, lastHash: 'abcdef1234567890fedcba' },
      })
    );

    await TestBed.configureTestingModule({
      imports: [AuditTrailComponent],
      providers: [
        { provide: AuditService, useValue: auditServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();
  });

  it('renders audit entries for authorized admins', () => {
    const fixture = TestBed.createComponent(AuditTrailComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(auditServiceSpy.list).toHaveBeenCalled();
    expect(compiled.textContent).toContain('Audit Trail');
    expect(compiled.textContent).toContain('Integrity Verified');
    expect(compiled.textContent).toContain('auth.login');
  });

  it('shows access denied state when permission is missing', () => {
    userSubject.next({ id: 'u2', role: 'delivery_manager', permissions: [] });

    const fixture = TestBed.createComponent(AuditTrailComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(auditServiceSpy.list).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('Access denied');
  });

  it('shows retry state when audit loading fails', () => {
    auditServiceSpy.list.and.returnValue(throwError(() => new Error('identity down')));

    const fixture = TestBed.createComponent(AuditTrailComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Unable to load audit events');
    expect(compiled.textContent).toContain('Try Again');
  });
});
