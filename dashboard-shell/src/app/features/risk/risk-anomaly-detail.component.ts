import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ProjectAnomaly, ProjectRiskTrend, RiskTrendSnapshot, RiskService } from '../../shared/services/risk.service';
import { ProjectsService } from '../../shared/services/projects.service';
import { getRecommendedActionsForAnomaly } from '../../shared/utils/risk-guidance';

@Component({
  selector: 'app-risk-anomaly-detail',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, DatePipe, TitleCasePipe],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <h1 class="text-display-lg">Project Anomaly Detail</h1>
          <p class="subtitle">Drilldown evidence for targeted remediation planning.</p>
          <p class="project-context" *ngIf="projectId">
            {{ projectName || 'Unknown Project' }} · {{ projectId }}
          </p>
        </div>
        <button mat-stroked-button type="button" (click)="goBack()">Back to Risk Analysis</button>
      </div>

      <mat-card class="state-card" *ngIf="loading">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading anomaly details...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="state-card error" *ngIf="!loading && errorMessage">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadAnomaly()">Retry</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="detail-card" *ngIf="!loading && !errorMessage && anomaly">
        <mat-card-header>
          <mat-card-title>{{ anomaly.projectId }}</mat-card-title>
          <mat-card-subtitle>
            {{ anomaly.severity }} severity · Score {{ anomaly.anomalyScore }} · {{ anomaly.trend | titlecase }} trend
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="metrics-grid">
            <div class="metric-item">
              <p class="metric-label">Total Events</p>
              <p class="metric-value">{{ anomaly.metrics.totalEvents }}</p>
            </div>
            <div class="metric-item">
              <p class="metric-label">Critical Events</p>
              <p class="metric-value">{{ anomaly.metrics.severityCounts.critical }}</p>
            </div>
            <div class="metric-item">
              <p class="metric-label">High Events</p>
              <p class="metric-value">{{ anomaly.metrics.severityCounts.high }}</p>
            </div>
            <div class="metric-item">
              <p class="metric-label">Latest Signal</p>
              <p class="metric-value metric-date">
                {{ anomaly.metrics.latestEventAt ? (anomaly.metrics.latestEventAt | date: 'medium') : 'No events available' }}
              </p>
            </div>
          </div>

          <div class="timeline-section">
            <h3>Severity Timeline Snapshot</h3>
            <div class="timeline-row" *ngFor="let bucket of getSeverityTimeline()">
              <div class="timeline-label">
                <span>{{ bucket.label }}</span>
                <span>{{ bucket.count }}</span>
              </div>
              <div class="timeline-track">
                <div
                  class="timeline-fill"
                  [class]="'timeline-' + bucket.key"
                  [style.width.%]="bucket.percent"
                ></div>
              </div>
            </div>
          </div>

          <div class="actions-section">
            <h3>Recommended Next Actions</h3>
            <ul>
              <li *ngFor="let action of getRecommendedActions()">{{ action }}</li>
            </ul>
          </div>

          <div class="reasons-section">
            <h3>Primary Anomaly Reasons</h3>
            <ul>
              <li *ngFor="let reason of anomaly.reasons">{{ reason }}</li>
            </ul>
          </div>

          <div class="trend-section" *ngIf="riskTrend && riskTrend.snapshots.length >= 2">
            <h3>7-Day Risk Score Trend</h3>
            <div class="sparkline-meta">
              <span class="trend-badge" [class]="'trend-' + riskTrend.trend">{{ riskTrend.trend | titlecase }}</span>
              <span class="trend-delta" [class]="riskTrend.deltaScore > 0 ? 'delta-up' : riskTrend.deltaScore < 0 ? 'delta-down' : ''">
                {{ riskTrend.deltaScore > 0 ? '+' : '' }}{{ riskTrend.deltaScore }} pts over {{ riskTrend.snapshots.length }} snapshots
              </span>
            </div>
            <svg class="sparkline" viewBox="0 0 220 48" aria-hidden="true">
              <polyline
                [attr.points]="getSparklinePath(riskTrend.snapshots)"
                fill="none"
                [attr.stroke]="getSparklineColor(riskTrend.trend)"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <circle
                *ngFor="let pt of getSparklinePoints(riskTrend.snapshots)"
                [attr.cx]="pt.x"
                [attr.cy]="pt.y"
                r="3"
                [attr.fill]="getSparklineColor(riskTrend.trend)"
              />
            </svg>
            <div class="sparkline-labels">
              <span>Snapshot 1</span>
              <span>Snapshot {{ riskTrend.snapshots.length }}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1100px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }

    h1 { margin: 0 0 8px 0; }

    .subtitle {
      color: var(--ri-on-surface-variant);
      margin: 0;
      font-size: 14px;
    }

    .project-context {
      margin: 8px 0 0 0;
      color: var(--ri-on-surface);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    .state-card,
    .detail-card {
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
      margin: 0;
      color: #ba1a1a;
    }

    .metrics-grid {
      margin-top: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .metric-item {
      padding: 10px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 8px;
      background: var(--ri-surface-container);
    }

    .metric-label {
      margin: 0;
      color: var(--ri-on-surface-variant);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .metric-value {
      margin: 8px 0 0 0;
      color: var(--ri-on-surface);
      font-size: 20px;
      font-weight: 700;
      line-height: 1.2;
    }

    .metric-value.metric-date {
      font-size: 13px;
      font-weight: 600;
    }

    .timeline-section {
      margin-top: 18px;
    }

    .timeline-section h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: 700;
    }

    .timeline-row {
      margin-bottom: 10px;
    }

    .timeline-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--ri-on-surface-variant);
      font-size: 12px;
      margin-bottom: 4px;
    }

    .timeline-track {
      width: 100%;
      height: 8px;
      border-radius: 999px;
      background: #e8eaed;
      overflow: hidden;
    }

    .timeline-fill {
      height: 100%;
      border-radius: inherit;
    }

    .timeline-critical {
      background: #ba1a1a;
    }

    .timeline-high {
      background: #f57c00;
    }

    .timeline-medium {
      background: #f9a825;
    }

    .timeline-low {
      background: #2e7d32;
    }

    .actions-section {
      margin-top: 18px;
      padding: 12px;
      border: 1px solid #d8e2ff;
      border-radius: 8px;
      background: #f4f7ff;
    }

    .actions-section h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 700;
      color: #1f3a7a;
    }

    .actions-section ul {
      margin: 0;
      padding-left: 20px;
      color: #244177;
    }

    .actions-section li {
      margin-bottom: 6px;
      line-height: 1.4;
    }

    .reasons-section {
      margin-top: 18px;
    }

    .reasons-section h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
      font-weight: 700;
    }

    .reasons-section ul {
      margin: 0;
      padding-left: 20px;
      color: var(--ri-on-surface-variant);
    }

    .reasons-section li {
      margin-bottom: 6px;
    }

    .trend-section {
      margin-top: 18px;
      padding: 14px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 8px;
      background: white;
    }

    .trend-section h3 {
      margin: 0 0 10px 0;
      font-size: 16px;
      font-weight: 700;
    }

    .sparkline-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }

    .trend-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .trend-worsening { background: #ffebee; color: #ba1a1a; }
    .trend-improving { background: #e8f5e9; color: #2e7d32; }
    .trend-stable    { background: #fff8e1; color: #f9a825; }
    .trend-insufficient_data { background: #f0ecf9; color: #565e74; }

    .trend-delta {
      font-size: 12px;
      font-weight: 600;
      color: var(--ri-on-surface-variant);
    }

    .delta-up   { color: #ba1a1a; }
    .delta-down { color: #2e7d32; }

    .sparkline {
      width: 100%;
      height: 48px;
      display: block;
    }

    .sparkline-labels {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: var(--ri-on-surface-variant);
      margin-top: 4px;
    }
  `],
})
export class RiskAnomalyDetailComponent implements OnInit {
  projectId = '';
  projectName = '';
  anomaly: ProjectAnomaly | null = null;
  riskTrend: ProjectRiskTrend | null = null;
  loading = false;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly riskService: RiskService,
    private readonly projectsService: ProjectsService
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('projectId') || '';
    this.loadAnomaly();
  }

  loadAnomaly(): void {
    if (!this.projectId) {
      this.errorMessage = 'Project identifier is required for anomaly drilldown.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      anomaly: this.riskService.getProjectAnomaly(this.projectId),
      projects: this.projectsService
        .getProjects()
        .pipe(catchError(() => of({ projects: [], total: 0 }))),
      trend: this.riskService.getProjectRiskTrend(this.projectId),
    })
      .pipe(
        catchError(() => of({ anomaly: null, projects: { projects: [], total: 0 }, trend: null })),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(({ anomaly, projects, trend }) => {
        this.projectName = projects.projects.find(project => project.id === this.projectId)?.name || '';
        this.anomaly = anomaly;
        this.riskTrend = trend;
        if (!anomaly) {
          this.errorMessage = 'Unable to load anomaly details for this project.';
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/risk']);
  }

  getSeverityTimeline(): Array<{ key: 'critical' | 'high' | 'medium' | 'low'; label: string; count: number; percent: number }> {
    if (!this.anomaly) {
      return [];
    }

    const total = this.anomaly.metrics.totalEvents || 1;
    const counts = this.anomaly.metrics.severityCounts;

    return [
      { key: 'critical', label: 'Critical', count: counts.critical, percent: Math.round((counts.critical / total) * 100) },
      { key: 'high', label: 'High', count: counts.high, percent: Math.round((counts.high / total) * 100) },
      { key: 'medium', label: 'Medium', count: counts.medium, percent: Math.round((counts.medium / total) * 100) },
      { key: 'low', label: 'Low', count: counts.low, percent: Math.round((counts.low / total) * 100) },
    ];
  }

  getRecommendedActions(): string[] {
    return getRecommendedActionsForAnomaly(this.anomaly);
  }

  getSparklinePoints(snapshots: RiskTrendSnapshot[]): Array<{ x: number; y: number }> {
    if (!snapshots.length) return [];
    const W = 220;
    const H = 48;
    const pad = 8;
    const scores = snapshots.map((s) => s.riskScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const range = maxScore - minScore || 1;

    return snapshots.map((s, i) => ({
      x: snapshots.length === 1 ? W / 2 : pad + (i / (snapshots.length - 1)) * (W - pad * 2),
      y: H - pad - ((s.riskScore - minScore) / range) * (H - pad * 2),
    }));
  }

  getSparklinePath(snapshots: RiskTrendSnapshot[]): string {
    return this.getSparklinePoints(snapshots)
      .map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`)
      .join(' ');
  }

  getSparklineColor(trend: string): string {
    if (trend === 'worsening') return '#ba1a1a';
    if (trend === 'improving') return '#2e7d32';
    return '#f9a825';
  }
}
