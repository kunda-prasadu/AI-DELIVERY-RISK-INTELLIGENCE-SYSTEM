import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Active Projects</h1>
      <p class="subtitle">Real-time supervision of active delivery tracks. Monitor cross-functional health metrics and risk distribution.</p>
      <mat-card class="content-placeholder">
        <mat-card-content>
          <p>Projects directory with advanced filtering and risk scoring coming soon...</p>
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
export class ProjectsComponent {}
