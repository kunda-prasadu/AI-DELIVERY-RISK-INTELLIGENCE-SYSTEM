import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <div class="dashboard-container">
      <h1 class="text-display-lg">Delivery Dashboard</h1>
      <p class="subtitle">Multi-stream project health monitoring and risk distribution tracking.</p>

      <div class="cards-grid">
        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Open High Risks</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">24</div>
            <p class="metric-detail text-label-md">Critical unreached</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Active Projects</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">12</div>
            <p class="metric-detail text-label-md">On track, 4 delayed</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Avg Probability</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">64%</div>
            <p class="metric-detail text-label-md">Stable since last sprint</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Resolved (7D)</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">18</div>
            <p class="metric-detail text-label-md">4 ahead of schedule</p>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Risk Distribution Heatmap</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>Heatmap visualization coming soon — powered by real-time event signals.</p>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>AI Prescriptive Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>Actionable recommendations based on detected risk patterns will appear here.</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1400px;
    }

    h1 {
      margin: 0 0 8px 0;
      color: var(--ri-on-surface);
    }

    .subtitle {
      color: var(--ri-on-surface-variant);
      margin: 0 0 32px 0;
      font-size: 14px;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .metric-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

      mat-card-header {
        border-bottom: 1px solid var(--ri-outline-variant);
        padding: 16px;
        margin: -16px -16px 16px -16px;
      }

      mat-card-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--ri-on-surface-variant);
        margin: 0;
      }

      mat-card-content {
        padding: 16px;
      }

      .metric-value {
        font-size: 36px;
        font-weight: 700;
        color: var(--ri-primary);
        margin: 0 0 8px 0;
      }

      .metric-detail {
        color: var(--ri-on-surface-variant);
        margin: 0;
      }
    }

    .section-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      margin-bottom: 24px;

      mat-card-header {
        border-bottom: 1px solid var(--ri-outline-variant);
        padding: 20px;
        margin: -20px -20px 20px -20px;
      }

      mat-card-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      mat-card-content {
        padding: 20px;
        color: var(--ri-on-surface-variant);
      }
    }
  `],
})
export class DashboardComponent {}
