import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RiskScore, RiskService } from '../services/risk.service';

export type TrendDirection = 'worsening' | 'improving' | 'stable' | 'insufficient_data' | null;
export type TrendAgeStatus = 'fresh' | 'stale' | null;

@Component({
  selector: 'app-risk-score-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <mat-card class="risk-card" [ngStyle]="{ 'border-left': '6px solid ' + getColor() }">
      <mat-card-header>
        <mat-card-title class="project-name">{{ riskScore.projectName }}</mat-card-title>
          <mat-card-subtitle class="band-badge" [ngStyle]="getBadgeStyle()">
            {{ riskScore.band }}
          </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <!-- Score Display -->
        <div class="score-display">
          <div class="score-circle" [ngStyle]="{ color: getColor() }">
            {{ riskScore.score }}
          </div>
          <span class="score-label">Risk Score</span>
        </div>

        <!-- Progress Bar -->
        <mat-progress-bar
          mode="determinate"
          [value]="riskScore.score"
           [style.--mdc-theme-primary]="getColor()"
          class="risk-bar"
        ></mat-progress-bar>

        <!-- Signals Grid -->
        <div class="signals-grid">
          <div class="signal">
            <span class="signal-label">Code Velocity</span>
            <span class="signal-value">{{ riskScore.signals.codeVelocity }}</span>
          </div>
          <div class="signal">
            <span class="signal-label">Quality</span>
            <span class="signal-value">{{ riskScore.signals.quality }}</span>
          </div>
          <div class="signal">
            <span class="signal-label">CI/CD</span>
            <span class="signal-value">{{ riskScore.signals.cicd }}</span>
          </div>
          <div class="signal">
            <span class="signal-label">Jira Velocity</span>
            <span class="signal-value">{{ riskScore.signals.jiraVelocity }}</span>
          </div>
        </div>

        <!-- Last Updated -->
        <div class="last-updated">
          <small>Updated {{ riskScore.lastUpdated | date: 'short' }}</small>
        </div>

        <!-- Trend Direction -->
        <div class="trend-row" *ngIf="trendLoading">
          <span class="trend-loading-chip" aria-label="Trend loading"></span>
        </div>

        <div class="trend-row" *ngIf="!trendLoading && trendDirection">
          <span class="trend-indicator" [class]="'trend-' + trendDirection">
            <ng-container *ngIf="trendDirection !== 'insufficient_data'">
              {{ getTrendArrow() }} {{ getTrendLabel() }}
            </ng-container>
            <ng-container *ngIf="trendDirection === 'insufficient_data'">
              Trend unavailable: insufficient snapshots
            </ng-container>
          </span>
        </div>

        <div class="trend-meta" *ngIf="!trendLoading && trendDirection && (trendLastUpdated || trendAgeStatus)">
          <small *ngIf="trendLastUpdated">Trend refreshed {{ trendLastUpdated | date: 'shortTime' }}</small>
          <span class="trend-age-chip" *ngIf="trendAgeStatus" [class]="'age-' + trendAgeStatus">
            {{ trendAgeStatus === 'fresh' ? 'Fresh' : 'Stale' }}
          </span>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .risk-card {
      padding: 16px;
      margin: 8px 0;
      background: var(--ri-surface);
      border-radius: 8px;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        cursor: pointer;
      }
    }

    mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding: 0;
    }

    .project-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--ri-on-surface);
      margin: 0 !important;
    }

    .band-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .score-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 12px;
    }

    .score-circle {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 4px;
    }

    .score-label {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .risk-bar {
      margin: 12px 0;
      height: 6px;
      border-radius: 3px;
    }

    .signals-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 12px;
    }

    .signal {
      display: flex;
      flex-direction: column;
      padding: 8px;
      background: var(--ri-surface-container);
      border-radius: 4px;
    }

    .signal-label {
      font-size: 11px;
      font-weight: 500;
      color: var(--ri-on-surface-variant);
    }

    .signal-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--ri-on-surface);
      margin-top: 2px;
    }

    .last-updated {
      margin-top: 8px;
      text-align: center;
      color: var(--ri-on-surface-variant);
    }

    .trend-row {
      margin-top: 10px;
      display: flex;
      justify-content: center;
    }

    .trend-meta {
      margin-top: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--ri-on-surface-variant);
    }

    .trend-age-chip {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-radius: 999px;
      padding: 2px 8px;
    }

    .age-fresh {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .age-stale {
      background: #fff8e1;
      color: #8a5a00;
    }

    .trend-loading-chip {
      width: 180px;
      height: 22px;
      border-radius: 999px;
      background: linear-gradient(90deg, #eceff1 25%, #f7f9fa 37%, #eceff1 63%);
      background-size: 400% 100%;
      animation: trend-loading 1.3s ease-in-out infinite;
      display: inline-block;
    }

    .trend-indicator {
      font-size: 12px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      letter-spacing: 0.03em;
    }

    .trend-worsening { background: #ffebee; color: #ba1a1a; }
    .trend-improving { background: #e8f5e9; color: #2e7d32; }
    .trend-stable    { background: #fff8e1; color: #f9a825; }
    .trend-insufficient_data { background: #f0ecf9; color: #565e74; }

    @keyframes trend-loading {
      0% { background-position: 100% 50%; }
      100% { background-position: 0 50%; }
    }
  `],
})
export class RiskScoreCardComponent {
  @Input() riskScore!: RiskScore;
  @Input() trendDirection: TrendDirection = null;
  @Input() trendLoading = false;
  @Input() trendLastUpdated: string | null = null;
  @Input() trendAgeStatus: TrendAgeStatus = null;

  constructor(public riskService: RiskService) {}

  getColor(): string {
    return this.riskService.getBandColor(this.riskScore.band);
  }

  getBadgeStyle(): object {
    return {
      background: this.riskService.getBandBackgroundColor(this.riskScore.band),
      color: this.riskService.getBandColor(this.riskScore.band),
    };
  }

  getTrendArrow(): string {
    if (this.trendDirection === 'worsening') return '↑';
    if (this.trendDirection === 'improving') return '↓';
    return '→';
  }

  getTrendLabel(): string {
    if (this.trendDirection === 'worsening') return 'Worsening';
    if (this.trendDirection === 'improving') return 'Improving';
    return 'Stable';
  }
}
