import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ProjectAnomaly, RiskService } from '../../shared/services/risk.service';
import { ProjectsService } from '../../shared/services/projects.service';

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

          <div class="reasons-section">
            <h3>Primary Anomaly Reasons</h3>
            <ul>
              <li *ngFor="let reason of anomaly.reasons">{{ reason }}</li>
            </ul>
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
  `],
})
export class RiskAnomalyDetailComponent implements OnInit {
  projectId = '';
  projectName = '';
  anomaly: ProjectAnomaly | null = null;
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
    })
      .pipe(
        catchError(() => of({ anomaly: null, projects: { projects: [], total: 0 } })),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(({ anomaly, projects }) => {
        this.projectName = projects.projects.find(project => project.id === this.projectId)?.name || '';
        this.anomaly = anomaly;
        if (!anomaly) {
          this.errorMessage = 'Unable to load anomaly details for this project.';
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/risk']);
  }
}
