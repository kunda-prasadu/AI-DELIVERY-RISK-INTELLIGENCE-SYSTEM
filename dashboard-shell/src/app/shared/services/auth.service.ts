import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly USER_KEY = 'ri_auth_user';
  private readonly ACCESS_TOKEN_KEY = 'ri_access_token';
  private readonly REFRESH_TOKEN_KEY = 'ri_refresh_token';

  private userSubject = new BehaviorSubject<AuthUser | null>(this.loadUser());
  public user$: Observable<AuthUser | null> = this.userSubject.asObservable();

  constructor() {}

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
