import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RiskScore, RiskService } from '../services/risk.service';

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
  `],
})
export class RiskScoreCardComponent {
  @Input() riskScore!: RiskScore;

  constructor(public riskService: RiskService) {}

  getColor(): string {
    return this.riskService.getBandColor(this.riskScore.band);
  }
  
    getBadgeStyle(): any {
      return {
        background: this.riskService.getBandBackgroundColor(this.riskScore.band),
        color: this.riskService.getBandColor(this.riskScore.band),
      };
    }
  }
