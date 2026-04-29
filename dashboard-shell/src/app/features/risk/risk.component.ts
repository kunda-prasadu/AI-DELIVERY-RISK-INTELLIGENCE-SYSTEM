import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Risk Analysis</h1>
      <p class="subtitle">Captured risk inventory with real-time repository of identified vulnerabilities and delivery blockers.</p>
      <mat-card class="content-placeholder">
        <mat-card-content>
          <p>Risk repository with categories, severity filtering, and AI justification coming soon...</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1400px;
    }
    h1 { margin: 0 0 8px 0; }
    .subtitle { color: var(--ri-on-surface-variant); margin: 0 0 24px 0; font-size: 14px; }
    .content-placeholder { background: white; border-radius: 8px; }
  `],
})
export class RiskComponent {}
