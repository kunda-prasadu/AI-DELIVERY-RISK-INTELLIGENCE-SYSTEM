import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../services/auth.service';

describe('SidebarComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let userSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    userSubject = new BehaviorSubject({ id: 'u1', role: 'admin', permissions: ['audit:read', 'projects:read', 'risk:read'] });
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['hasRole', 'hasPermission'], {
      user$: userSubject.asObservable(),
    });

    authServiceSpy.hasRole.and.callFake((roles: string[]) => roles.includes(userSubject.value.role));
    authServiceSpy.hasPermission.and.callFake((permission: string) => userSubject.value.permissions.includes(permission));

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [{ provide: AuthService, useValue: authServiceSpy }, provideRouter([])],
    }).compileComponents();
  });

  it('shows audit trail navigation for admins with audit permission', () => {
    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Audit Trail');
  });

  it('hides audit trail navigation when audit permission is missing', () => {
    userSubject.next({ id: 'u2', role: 'delivery_manager', permissions: ['projects:read', 'risk:read'] });
    authServiceSpy.hasRole.and.callFake((roles: string[]) => roles.includes(userSubject.value.role));
    authServiceSpy.hasPermission.and.callFake((permission: string) => userSubject.value.permissions.includes(permission));

    const fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Audit Trail');
  });
});
