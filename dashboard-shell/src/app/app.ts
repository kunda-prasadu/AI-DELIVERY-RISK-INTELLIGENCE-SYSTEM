import { Component, OnInit } from '@angular/core';
import { NavigationEnd, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { AuthService } from './shared/services/auth.service';
import { RiskService } from './shared/services/risk.service';
import { PerformanceService } from './shared/services/performance.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  title = 'RiskIntel Dashboard';
  private navigationStartMs = 0;

  constructor(
    private authService: AuthService,
    private riskService: RiskService,
    private performanceService: PerformanceService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.trackRoutePerformance();
    this.recordInitialNavigation();

    this.authService.initializeSession().subscribe(() => {
      // Refresh risk data after auth is initialized so protected endpoints succeed.
      this.riskService.refreshRiskScores().subscribe();
    });
  }

  private trackRoutePerformance(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.navigationStartMs = performance.now();
      }

      if (event instanceof NavigationEnd && this.navigationStartMs > 0) {
        const routeDurationMs = Math.round(performance.now() - this.navigationStartMs);
        this.performanceService.recordDashboardRender(event.urlAfterRedirects, routeDurationMs).subscribe({
          error: () => undefined,
        });
      }
    });
  }

  private recordInitialNavigation(): void {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!navigationEntry) {
      return;
    }

    this.performanceService.recordDashboardRender(window.location.pathname || '/dashboard', Math.round(navigationEntry.duration)).subscribe({
      error: () => undefined,
    });
  }
}
