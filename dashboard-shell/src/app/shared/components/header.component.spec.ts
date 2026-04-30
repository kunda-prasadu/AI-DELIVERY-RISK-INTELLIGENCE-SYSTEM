import { TestBed } from '@angular/core/testing';
import { of, BehaviorSubject } from 'rxjs';
import { HeaderComponent } from './header.component';
import { AuthService } from '../services/auth.service';
import { AlertService } from '../services/alert.service';

describe('HeaderComponent', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let alertServiceSpy: jasmine.SpyObj<AlertService>;
  let userSubject: BehaviorSubject<any>;

  beforeEach(async () => {
    userSubject = new BehaviorSubject(null);
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], {
      user$: userSubject.asObservable(),
    });
    alertServiceSpy = jasmine.createSpyObj<AlertService>('AlertService', [
      'getActiveAlertCount',
    ]);
    alertServiceSpy.getActiveAlertCount.and.returnValue(of(0));

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: AlertService, useValue: alertServiceSpy },
      ],
    }).compileComponents();
  });

  it('should render header with search box and action buttons', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.header')).toBeTruthy();
    expect(el.querySelector('.search-box')).toBeTruthy();
    expect(el.querySelector('.header-right')).toBeTruthy();
  });

  it('should NOT show notification badge when activeAlertCount is 0', () => {
    alertServiceSpy.getActiveAlertCount.and.returnValue(of(0));

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.notification-badge');
    expect(badge).toBeNull();
  });

  it('should show notification badge with count when alerts are active', () => {
    alertServiceSpy.getActiveAlertCount.and.returnValue(of(5));

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.notification-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent?.trim()).toBe('5');
    expect(fixture.componentInstance.activeAlertCount).toBe(5);
  });

  it('should cap badge display at 99+ for large counts', () => {
    alertServiceSpy.getActiveAlertCount.and.returnValue(of(150));

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.notification-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('99+');
  });

  it('should compute user initials from email', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();

    userSubject.next({ id: 'u1', email: 'jane.doe@acme.com', role: 'admin', permissions: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance.initials).toBe('JD');
  });
});
