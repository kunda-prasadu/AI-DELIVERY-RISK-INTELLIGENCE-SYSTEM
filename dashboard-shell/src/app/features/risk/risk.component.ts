import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { RiskScore, RiskService } from '../../shared/services/risk.service';
import { RiskHeatmapComponent } from '../../shared/components/risk-heatmap.component';
import { RiskScoreCardComponent } from '../../shared/components/risk-score-card.component';

@Component({
  selector: 'app-risk',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    RiskHeatmapComponent,
    RiskScoreCardComponent,
  ],
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

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && riskScores.length">
        <mat-card-header>
          <mat-card-title>Portfolio Risk Heatmap</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <app-risk-heatmap [riskScores]="riskScores"></app-risk-heatmap>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && riskScores.length">
        <mat-card-header>
          <mat-card-title>Detailed Risk Scorecards</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="risk-grid">
            <app-risk-score-card *ngFor="let score of riskScores" [riskScore]="score"></app-risk-score-card>
          </div>
        </mat-card-content>
      </mat-card>

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

    .section-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .risk-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
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
