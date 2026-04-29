import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-actions',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Action Center</h1>
      <p class="subtitle">Real-time recommendation tracking and adoption intelligence.</p>
      <mat-card class="content-placeholder">
        <mat-card-content>
          <p>Active recommendations, adoption rate tracking, and team leaderboard coming soon...</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1400px; }
    h1 { margin: 0 0 8px 0; }
    .subtitle { color: var(--ri-on-surface-variant); margin: 0 0 24px 0; font-size: 14px; }
    .content-placeholder { background: white; border-radius: 8px; }
  `],
})
export class ActionsComponent {}
