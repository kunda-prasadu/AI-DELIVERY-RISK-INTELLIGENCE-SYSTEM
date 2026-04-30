import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthLoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

interface AuthProfileResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  permissions: string[];
}

interface AuthRegisterResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly AUTH_BASE = '/api/auth';
  private readonly USER_KEY = 'ri_auth_user';
  private readonly ACCESS_TOKEN_KEY = 'ri_access_token';
  private readonly REFRESH_TOKEN_KEY = 'ri_refresh_token';
  private readonly SEEDED_DEMO_EMAIL = 'admin@ai-delivery-risk.io';
  private readonly SEEDED_DEMO_PASSWORD = 'Admin@12345!';
  private readonly SEEDED_DEMO_NAME = 'System Admin';
  private readonly SEEDED_DEMO_ROLE = 'admin';

  private userSubject = new BehaviorSubject<AuthUser | null>(this.loadUser());
  public user$: Observable<AuthUser | null> = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  initializeSession(): Observable<AuthUser | null> {
    if (this.getAccessToken()) {
      return this.fetchProfile().pipe(
        tap(user => this.userSubject.next(user)),
        map(user => user),
        catchError(() => {
          this.logout();
          return this.loginSeededAdmin();
        })
      );
    }

    return this.loginSeededAdmin();
  }

  login(email: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthLoginResponse>(`${this.AUTH_BASE}/login`, { email, password })
      .pipe(
        tap(response => {
          localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
          localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
        }),
        switchMap(() => this.fetchProfile()),
        tap(user => {
          this.userSubject.next(user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        })
      );
  }

  getProfile(): Observable<AuthUser> {
    return this.fetchProfile().pipe(
      tap(user => {
        this.userSubject.next(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      })
    );
  }

  private loginSeededAdmin(): Observable<AuthUser | null> {
    return this.login(this.SEEDED_DEMO_EMAIL, this.SEEDED_DEMO_PASSWORD).pipe(
      map(user => user as AuthUser | null),
      catchError(() => {
        return this.registerSeededDemoUser().pipe(
          map(user => user as AuthUser | null),
          catchError(() => {
            // Keep the dashboard usable even when backend services are down.
            return of(this.seedDemoUserFallback());
          })
        );
      })
    );
  }

  private registerSeededDemoUser(): Observable<AuthUser> {
    return this.http
      .post<AuthRegisterResponse>(`${this.AUTH_BASE}/register`, {
        email: this.SEEDED_DEMO_EMAIL,
        password: this.SEEDED_DEMO_PASSWORD,
        name: this.SEEDED_DEMO_NAME,
        role: this.SEEDED_DEMO_ROLE,
      })
      .pipe(
        tap(response => {
          localStorage.setItem(this.ACCESS_TOKEN_KEY, response.accessToken);
          localStorage.setItem(this.REFRESH_TOKEN_KEY, response.refreshToken);
        }),
        switchMap(() => this.fetchProfile()),
        tap(user => {
          this.userSubject.next(user);
          localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        }),
        catchError(() => this.login(this.SEEDED_DEMO_EMAIL, this.SEEDED_DEMO_PASSWORD))
      );
  }

  private fetchProfile(): Observable<AuthUser> {
    return this.http.get<AuthProfileResponse>(`${this.AUTH_BASE}/me`).pipe(
      map(response => ({
        id: response.user.id,
        email: response.user.email,
        role: response.user.role,
        permissions: response.permissions,
      }))
    );
  }

  private seedDemoUserFallback(): AuthUser {
    const demoUser: AuthUser = {
      id: 'demo-user-001',
      email: 'admin@ai-delivery-risk.io',
      role: 'admin',
      permissions: [
        'audit:read',
        'alerts:read',
        'connectors:manage',
        'projects:read',
        'projects:write',
        'reports:read',
        'reports:generate',
        'risk:read',
        'users:read',
        'users:write',
        'recommendations:assign',
      ],
    };

    this.setAuthState(demoUser, {
      accessToken: 'demo-token-access',
      refreshToken: 'demo-token-refresh',
    });

    return demoUser;
  }

  /**
   * Load user from localStorage. Call this once on app init.
   */
  private loadUser(): AuthUser | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as AuthUser;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Initialize auth state after successful login (called from identity-service integration).
   */
  setAuthState(user: AuthUser, tokens: AuthTokens): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);
    this.userSubject.next(user);
  }

  /**
   * Get the currently authenticated user.
   */
  getCurrentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  /**
   * Get the access token.
   */
  getAccessToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  /**
   * Check if user has a specific permission.
   */
  hasPermission(permission: string): boolean {
    const user = this.userSubject.value;
    if (!user) return false;
    return user.permissions?.includes(permission) ?? false;
  }

  /**
   * Check if user has one of the specified roles.
   */
  hasRole(role: string | string[]): boolean {
    const user = this.userSubject.value;
    if (!user) return false;
    const roles = Array.isArray(role) ? role : [role];
    return roles.includes(user.role);
  }

  /**
   * Logout — clear all auth state.
   */
  logout(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    this.userSubject.next(null);
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.userSubject.value !== null;
  }
}
