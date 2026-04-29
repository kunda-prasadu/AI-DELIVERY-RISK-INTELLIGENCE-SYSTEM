import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './shared/services/auth.service';
import { RiskService } from './shared/services/risk.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  title = 'RiskIntel Dashboard';

  constructor(
    private authService: AuthService,
    private riskService: RiskService
  ) {}

  ngOnInit(): void {
    this.authService.initializeSession().subscribe(() => {
      // Refresh risk data after auth is initialized so protected endpoints succeed.
      this.riskService.refreshRiskScores().subscribe();
    });
  }
}
