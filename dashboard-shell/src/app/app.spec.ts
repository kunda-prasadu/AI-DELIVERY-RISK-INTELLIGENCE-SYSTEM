import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { App } from './app';
import { AuthService } from './shared/services/auth.service';
import { RiskService } from './shared/services/risk.service';

describe('App', () => {
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let riskServiceSpy: jasmine.SpyObj<RiskService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', ['initializeSession']);
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', ['refreshRiskScores']);

    authServiceSpy.initializeSession.and.returnValue(of({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
      permissions: [],
    } as any));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: RiskService, useValue: riskServiceSpy },
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
