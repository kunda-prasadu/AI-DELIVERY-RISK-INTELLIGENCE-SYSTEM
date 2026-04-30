import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ProjectsService } from '../../shared/services/projects.service';
import { ProjectAnomaly, ProjectRiskTrend, RiskScore, RiskService } from '../../shared/services/risk.service';
import { AlertService, ProjectAlert } from '../../shared/services/alert.service';
import { getRecommendedActionsForAnomaly } from '../../shared/utils/risk-guidance';
import { RiskHeatmapComponent } from '../../shared/components/risk-heatmap.component';
import { RiskScoreCardComponent, TrendDirection } from '../../shared/components/risk-score-card.component';

interface DashboardMetrics {
  openHighRisks: number;
  activeProjects: number;
  avgProbability: number;
  lowRiskProjects: number;
}

@Component({
  selector: 'app-dashboard',
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
    <div class="dashboard-container">
      <h1 class="text-display-lg">Delivery Dashboard</h1>
      <p class="subtitle">Multi-stream project health monitoring and risk distribution tracking.</p>

      <div class="toolbar-row">
        <p class="last-updated" *ngIf="lastUpdated && !loading">Last updated: {{ lastUpdated }}</p>
        <button mat-stroked-button type="button" (click)="loadDashboard()" [disabled]="loading">Refresh</button>
      </div>

      <mat-card class="state-card" *ngIf="loading">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading live dashboard metrics...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="state-card error" *ngIf="!loading && errorMessage">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadDashboard()">Try Again</button>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="cards-grid" *ngIf="!loading && !errorMessage">
        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Open High Risks</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">{{ metrics.openHighRisks }}</div>
            <p class="metric-detail text-label-md">HIGH and CRITICAL portfolio risks</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Active Projects</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">{{ metrics.activeProjects }}</div>
            <p class="metric-detail text-label-md">Currently tracked in gateway</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Avg Probability</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">{{ metrics.avgProbability }}%</div>
            <p class="metric-detail text-label-md">Average model-derived risk score</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card">
          <mat-card-header>
            <mat-card-title>Low-Risk Projects</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="metric-value">{{ metrics.lowRiskProjects }}</div>
            <p class="metric-detail text-label-md">Projects currently in LOW band</p>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>Portfolio Risk Heatmap</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!topRisks.length">No portfolio risk data is available for the heatmap yet.</p>
          <app-risk-heatmap *ngIf="topRisks.length" [riskScores]="topRisks"></app-risk-heatmap>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>Risk Scorecards</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!topRisks.length">No scorecards are available until risk scores load.</p>
          <div class="scorecards-grid" *ngIf="topRisks.length">
            <app-risk-score-card
              *ngFor="let risk of topRisks.slice(0, 3)"
              [riskScore]="risk"
              [trendDirection]="projectTrendDirections[risk.projectId] || null"
            ></app-risk-score-card>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>Highest Risk Programs</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!topRisks.length">No risk scores are available yet.</p>
          <div class="list-row" *ngFor="let risk of topRisks">
            <span class="program-name">{{ risk.projectName }}</span>
            <span class="risk-chip" [class]="'risk-' + risk.band.toLowerCase()">
              {{ risk.band }} · {{ risk.score }}
            </span>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>Anomaly Radar</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!topAnomalies.length">No anomaly detections are currently active.</p>
          <div class="list-row" *ngFor="let anomaly of topAnomalies">
            <div class="anomaly-detail">
              <span class="program-name">{{ anomaly.projectId }}</span>
              <p class="anomaly-reason">{{ anomaly.reasons[0] || 'No anomaly rationale available.' }}</p>
              <p class="anomaly-action-hint" role="button" tabindex="0"
                (click)="openAnomalyDetail(anomaly.projectId)"
                (keyup.enter)="openAnomalyDetail(anomaly.projectId)">Action: {{ getTopAnomalyAction(anomaly) }}</p>
            </div>
            <div class="anomaly-actions">
              <span class="risk-chip" [class]="'risk-' + anomaly.severity.toLowerCase()">
                {{ anomaly.severity }} · {{ anomaly.anomalyScore }}
              </span>
              <button mat-stroked-button type="button" (click)="openAnomalyDetail(anomaly.projectId)">
                View Details
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>Active Alerts</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!topAlerts.length">No threshold breaches are currently active.</p>
          <div class="list-row" *ngFor="let alert of topAlerts">
            <div class="anomaly-detail">
              <span class="program-name">{{ alert.projectId }}</span>
              <p class="anomaly-reason">
                {{ alert.breaches[0]?.message || 'Threshold breach detected.' }}
              </p>
            </div>
            <div class="anomaly-actions">
              <span class="risk-chip" [class]="getAlertSeverityChipClass(alert)">
                {{ alert.severity || 'NONE' }} · {{ alert.breachCount }}
              </span>
              <button mat-stroked-button type="button" (click)="openAnomalyDetail(alert.projectId)">
                Investigate
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>AI Prescriptive Actions</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p class="action" *ngIf="metrics.openHighRisks === 0">No urgent escalations needed. Keep monitoring delivery signals.</p>
          <p class="action" *ngIf="metrics.openHighRisks > 0">
            Prioritize remediation plans for {{ metrics.openHighRisks }} high-risk programs and trigger engineering deep-dive reviews.
          </p>
          <p class="action" *ngIf="metrics.avgProbability >= 70">
            Portfolio trend is elevated; enforce weekly risk reviews with cross-team owners.
          </p>
          <p class="action" *ngIf="metrics.avgProbability < 70">
            Portfolio trend is moderate; keep current cadence and focus on outlier programs.
          </p>
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

    .toolbar-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
    }

    .last-updated {
      margin: 0;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
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

    .scorecards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .list-row {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .anomaly-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }

    .program-name {
      color: var(--ri-on-surface);
      font-size: 14px;
      font-weight: 500;
    }

    .anomaly-detail {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .anomaly-reason {
      margin: 0;
      color: var(--ri-on-surface-variant);
      font-size: 12px;
    }

    .anomaly-action-hint {
      margin: 0;
      color: #1f3a7a;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.35;
      max-width: 700px;
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: transparent;
      transition: text-decoration-color 0.15s ease;

      &:hover, &:focus {
        text-decoration-color: #1f3a7a;
        outline: none;
      }
    }

    .risk-chip {
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
    }

    .risk-critical {
      background: #ffebee;
      color: #ba1a1a;
    }

    .risk-high {
      background: #ffe8cc;
      color: #f57c00;
    }

    .risk-medium {
      background: #fff8e1;
      color: #f9a825;
    }

    .risk-low {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .action {
      margin: 0 0 10px 0;
      color: var(--ri-on-surface-variant);
      font-size: 14px;
      line-height: 1.45;
    }
  `],
})
export class DashboardComponent implements OnInit {
  loading = false;
  errorMessage = '';
  lastUpdated = '';

  metrics: DashboardMetrics = {
    openHighRisks: 0,
    activeProjects: 0,
    avgProbability: 0,
    lowRiskProjects: 0,
  };

  topRisks: RiskScore[] = [];
  topAnomalies: ProjectAnomaly[] = [];
  topAlerts: ProjectAlert[] = [];
  projectTrendDirections: Record<string, TrendDirection> = {};

  constructor(
    private projectsService: ProjectsService,
    private riskService: RiskService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      projects: this.projectsService.getProjects().pipe(catchError(() => of({ projects: [], total: 0 }))),
      risks: this.riskService.refreshRiskScores().pipe(catchError(() => of([]))),
      anomalies: this.riskService.getPortfolioAnomalies().pipe(catchError(() => of([]))),
      alerts: this.alertService.getPortfolioAlerts().pipe(catchError(() => of({ totalActive: 0, alerts: [] }))),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(({ projects, risks, anomalies, alerts }) => {
        const riskScores = risks as RiskScore[];

        if (!projects.projects.length && !riskScores.length) {
          this.errorMessage = 'Dashboard data is unavailable. Verify gateway and project services are healthy.';
          return;
        }

        const highRiskCount = riskScores.filter(score => score.band === 'HIGH' || score.band === 'CRITICAL').length;
        const lowRiskCount = riskScores.filter(score => score.band === 'LOW').length;
        const avgRiskScore = riskScores.length
          ? Math.round(riskScores.reduce((sum, score) => sum + score.score, 0) / riskScores.length)
          : 0;

        this.metrics = {
          openHighRisks: highRiskCount,
          activeProjects: projects.total || projects.projects.length,
          avgProbability: avgRiskScore,
          lowRiskProjects: lowRiskCount,
        };

        this.topRisks = [...riskScores]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        this.loadScorecardTrends(this.topRisks);

        this.topAnomalies = [...(anomalies as ProjectAnomaly[])]
          .sort((a, b) => b.anomalyScore - a.anomalyScore)
          .slice(0, 5);

        this.topAlerts = [...alerts.alerts]
          .sort((a, b) => b.breachCount - a.breachCount)
          .slice(0, 5);

        this.lastUpdated = new Date().toLocaleString();
      });
  }

  openAnomalyDetail(projectId: string): void {
    this.router.navigate(['/risk/anomalies', projectId]);
  }

  getTopAnomalyAction(anomaly: ProjectAnomaly): string {
    return getRecommendedActionsForAnomaly(anomaly)[0] || 'Continue monitoring and re-evaluate on next snapshot.';
  }

  private loadScorecardTrends(risks: RiskScore[]): void {
    const topScorecardIds = risks.slice(0, 3).map((risk) => risk.projectId);
    if (!topScorecardIds.length) {
      this.projectTrendDirections = {};
      return;
    }

    const trendRequests = topScorecardIds.map((projectId) =>
      this.riskService.getProjectRiskTrend(projectId).pipe(catchError(() => of(null)))
    );

    forkJoin(trendRequests).subscribe((trends) => {
      const nextTrends: Record<string, TrendDirection> = {};
      trends.forEach((trend, index) => {
        nextTrends[topScorecardIds[index]] = (trend as ProjectRiskTrend | null)?.trend ?? null;
      });
      this.projectTrendDirections = nextTrends;
    });
  }

  getAlertSeverityChipClass(alert: ProjectAlert): string {
    const severity = (alert.severity || 'LOW').toLowerCase();
    return `risk-${severity}`;
  }
}
