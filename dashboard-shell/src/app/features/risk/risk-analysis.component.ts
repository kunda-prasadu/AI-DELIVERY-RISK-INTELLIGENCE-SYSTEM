import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { RiskHeatmapComponent } from '../../shared/components/risk-heatmap.component';
import { RiskScoreCardComponent } from '../../shared/components/risk-score-card.component';
import { RiskService, RiskScore } from '../../shared/services/risk.service';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatDividerModule,
    RiskHeatmapComponent,
    RiskScoreCardComponent,
  ],
  template: `
    <div class="risk-container">
      <div class="risk-header">
        <h1>Risk Analysis Dashboard</h1>
        <p class="risk-subtitle">Monitor and analyze project delivery risks in real-time</p>
      </div>

      <mat-tab-group class="risk-tabs">
        <!-- Heatmap Tab -->
        <mat-tab label="Heatmap View">
          <ng-template mat-tab-label>
            <span class="tab-label">Heatmap View</span>
          </ng-template>
          <div class="tab-content">
            <app-risk-heatmap></app-risk-heatmap>
          </div>
        </mat-tab>

        <!-- Detailed Cards Tab -->
        <mat-tab label="Detailed Analysis">
          <ng-template mat-tab-label>
            <span class="tab-label">Detailed Analysis</span>
          </ng-template>
          <div class="tab-content">
            <div class="cards-container">
              <div class="filters">
                <p class="filter-label">Showing {{ riskScores.length }} projects</p>
              </div>
              <div class="risk-cards-grid">
                <app-risk-score-card
                  *ngFor="let score of riskScores"
                  [riskScore]="score"
                  class="risk-card-item"
                ></app-risk-score-card>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Statistics Tab -->
        <mat-tab label="Statistics">
          <ng-template mat-tab-label>
            <span class="tab-label">Statistics</span>
          </ng-template>
          <div class="tab-content">
            <div class="stats-grid">
              <div class="stat-card critical">
                <div class="stat-value">{{ getCriticalCount() }}</div>
                <div class="stat-label">Critical Risk Projects</div>
              </div>
              <div class="stat-card high">
                <div class="stat-value">{{ getHighCount() }}</div>
                <div class="stat-label">High Risk Projects</div>
              </div>
              <div class="stat-card medium">
                <div class="stat-value">{{ getMediumCount() }}</div>
                <div class="stat-label">Medium Risk Projects</div>
              </div>
              <div class="stat-card low">
                <div class="stat-value">{{ getLowCount() }}</div>
                <div class="stat-label">Low Risk Projects</div>
              </div>
              <div class="stat-card average">
                <div class="stat-value">{{ getAverageScore() }}</div>
                <div class="stat-label">Average Risk Score</div>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .risk-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .risk-header {
      margin-bottom: 24px;

      h1 {
        margin: 0 0 8px 0;
        font-size: 32px;
        font-weight: 700;
        color: var(--ri-on-surface);
      }
    }

    .risk-subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--ri-on-surface-variant);
    }

    .risk-tabs {
      margin-top: 16px;
    }

    .tab-label {
      font-size: 14px;
      font-weight: 500;
    }

    .tab-content {
      padding: 24px 0;
    }

    .cards-container {
      padding: 16px;
      background: var(--ri-surface-container);
      border-radius: 8px;
    }

    .filter-label {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--ri-on-surface-variant);
    }

    .risk-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .risk-card-item {
      display: block;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 16px;
    }

    .stat-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      transition: all 0.2s ease;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      }

      &.critical {
        background: #ffebee;
        border-left: 4px solid #ba1a1a;
      }

      &.high {
        background: #ffe8cc;
        border-left: 4px solid #f57c00;
      }

      &.medium {
        background: #fff8e1;
        border-left: 4px solid #f9a825;
      }

      &.low {
        background: #e8f5e9;
        border-left: 4px solid #2e7d32;
      }

      &.average {
        background: var(--ri-surface-container);
        border-left: 4px solid #3525cd;
      }
    }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 8px;

      .stat-card.critical & {
        color: #ba1a1a;
      }

      .stat-card.high & {
        color: #f57c00;
      }

      .stat-card.medium & {
        color: #f9a825;
      }

      .stat-card.low & {
        color: #2e7d32;
      }

      .stat-card.average & {
        color: #3525cd;
      }
    }

    .stat-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--ri-on-surface-variant);
    }
  `],
})
export class RiskComponent implements OnInit {
  riskScores: RiskScore[] = [];

  constructor(private riskService: RiskService) {}

  ngOnInit(): void {
    this.riskService.getRiskScores().subscribe(scores => {
      this.riskScores = scores;
    });
  }

  getCriticalCount(): number {
    return this.riskScores.filter(s => s.band === 'CRITICAL').length;
  }

  getHighCount(): number {
    return this.riskScores.filter(s => s.band === 'HIGH').length;
  }

  getMediumCount(): number {
    return this.riskScores.filter(s => s.band === 'MEDIUM').length;
  }

  getLowCount(): number {
    return this.riskScores.filter(s => s.band === 'LOW').length;
  }

  getAverageScore(): number {
    if (this.riskScores.length === 0) return 0;
    const sum = this.riskScores.reduce((acc, s) => acc + s.score, 0);
    return Math.round(sum / this.riskScores.length);
  }
}
