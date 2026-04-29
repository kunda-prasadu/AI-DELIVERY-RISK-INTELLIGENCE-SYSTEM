import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  title = 'RiskIntel Dashboard';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // Initialize auth state from localStorage (for demo purposes).
    // In production, this would call an identity-service /auth/me endpoint.
    // For now, we seed a demo user for testing RBAC.
    if (!this.authService.isAuthenticated()) {
      this.authService.setAuthState(
        {
          id: 'demo-user-001',
          email: 'delivery@example.com',
          role: 'delivery_manager',
          permissions: [
            'projects:read',
            'projects:write',
            'risk:read',
            'recommendations:assign',
          ],
        },
        {
          accessToken: 'demo-token-access',
          refreshToken: 'demo-token-refresh',
        }
      );
    }
  }
}
