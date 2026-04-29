import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { RiskScore, RiskService } from '../../shared/services/risk.service';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Risk Analysis</h1>
      <p class="subtitle">Captured risk inventory with real-time repository of identified vulnerabilities and delivery blockers.</p>

      <div class="toolbar-row">
        <p class="summary" *ngIf="!loading && !errorMessage">
          Tracking {{ riskScores.length }} programs from live scoring data.
        </p>
        <button mat-stroked-button type="button" (click)="loadRiskScores()" [disabled]="loading">Refresh</button>
      </div>

      <mat-card class="state-card" *ngIf="loading">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading risk scores...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="state-card error" *ngIf="!loading && errorMessage">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadRiskScores()">Try Again</button>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="stats-grid" *ngIf="!loading && !errorMessage && riskScores.length">
        <mat-card class="stat-card critical">
          <mat-card-content>
            <p class="stat-value">{{ getBandCount('CRITICAL') }}</p>
            <p class="stat-label">Critical</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card high">
          <mat-card-content>
            <p class="stat-value">{{ getBandCount('HIGH') }}</p>
            <p class="stat-label">High</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card medium">
          <mat-card-content>
            <p class="stat-value">{{ getBandCount('MEDIUM') }}</p>
            <p class="stat-label">Medium</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card low">
          <mat-card-content>
            <p class="stat-value">{{ getBandCount('LOW') }}</p>
            <p class="stat-label">Low</p>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="risk-grid" *ngIf="!loading && !errorMessage && riskScores.length">
        <mat-card class="risk-card" *ngFor="let score of riskScores">
          <mat-card-header>
            <mat-card-title>{{ score.projectName }}</mat-card-title>
            <mat-card-subtitle>{{ score.projectId }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="score-row">
              <span class="score">{{ score.score }}</span>
              <span class="band" [class]="'band-' + score.band.toLowerCase()">{{ score.band }}</span>
            </div>
            <p class="signals-title">Signal profile</p>
            <div class="signals-grid">
              <span>Code Velocity: {{ score.signals.codeVelocity }}</span>
              <span>Quality: {{ score.signals.quality }}</span>
              <span>CI/CD: {{ score.signals.cicd }}</span>
              <span>Jira Velocity: {{ score.signals.jiraVelocity }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="state-card" *ngIf="!loading && !errorMessage && !riskScores.length">
        <mat-card-content>
          <div class="state-content">
            <p>No risk scores are available yet.</p>
          </div>
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

    .toolbar-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .summary {
      margin: 0;
      color: var(--ri-on-surface-variant);
      font-size: 14px;
    }

    .state-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .state-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .state-card.error p {
      color: #ba1a1a;
      margin: 0;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat-card {
      background: white;
      border-radius: 8px;
    }

    .stat-value {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      line-height: 1.1;
    }

    .stat-label {
      margin: 6px 0 0 0;
      color: var(--ri-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .stat-card.critical .stat-value { color: #ba1a1a; }
    .stat-card.high .stat-value { color: #f57c00; }
    .stat-card.medium .stat-value { color: #f9a825; }
    .stat-card.low .stat-value { color: #2e7d32; }

    .risk-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }

    .risk-card {
      background: white;
      border-radius: 8px;
    }

    .score-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .score {
      font-size: 30px;
      font-weight: 700;
      line-height: 1;
      color: var(--ri-primary);
    }

    .band {
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      letter-spacing: 0.3px;
    }

    .band-critical {
      background: #ffebee;
      color: #ba1a1a;
    }

    .band-high {
      background: #ffe8cc;
      color: #f57c00;
    }

    .band-medium {
      background: #fff8e1;
      color: #f9a825;
    }

    .band-low {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .signals-title {
      margin: 0 0 8px 0;
      color: var(--ri-on-surface);
      font-size: 13px;
      font-weight: 600;
    }

    .signals-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .signals-grid span {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }
  `],
})
export class RiskComponent implements OnInit {
  riskScores: RiskScore[] = [];
  loading = false;
  errorMessage = '';

  constructor(private riskService: RiskService) {}

  ngOnInit(): void {
    this.loadRiskScores();
  }

  loadRiskScores(): void {
    this.loading = true;
    this.errorMessage = '';

    this.riskService
      .refreshRiskScores()
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load risk scores. Verify gateway and project service health.';
          return of([] as RiskScore[]);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(scores => {
        this.riskScores = [...scores].sort((a, b) => b.score - a.score);
      });
  }

  getBandCount(band: RiskScore['band']): number {
    return this.riskScores.filter(score => score.band === band).length;
  }
}
