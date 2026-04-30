import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { RiskService, ProjectAnomaly } from '../../shared/services/risk.service';
import { ProjectsService, ProjectItem } from '../../shared/services/projects.service';
import { getRecommendedActionsForAnomaly } from '../../shared/utils/risk-guidance';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

interface RecommendedAction {
  id: string;
  projectId: string;
  projectName: string;
  anomalyId: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  source: 'severity_escalation' | 'trend_management' | 'event_review' | 'tracking';
  generatedAt: number;
  status: 'open' | 'in_progress' | 'completed';
}

interface AdoptionTelemetryPoint {
  timestamp: number;
  openCount: number;
  inProgressCount: number;
  completedCount: number;
  adoptionRate: number;
}

interface TelemetryChartPoint {
  x: number;
  y: number;
  point: AdoptionTelemetryPoint;
}

type TelemetrySeriesKey = 'adoption' | 'completed' | 'inProgress';

interface TelemetrySeriesDefinition {
  key: TelemetrySeriesKey;
  label: string;
  color: string;
}

type TelemetryZoomLevel = 1 | 2 | 4;

type TelemetryWindow = '1h' | '24h' | '7d';

@Component({
  selector: 'app-actions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTabsModule,
  ],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <h1 class="text-display-lg">Action Center</h1>
          <p class="subtitle">Recommended actions across active projects, prioritized by risk level.</p>
        </div>
        <div class="stats-row">
          <div class="stat">
            <span class="stat-value">{{ totalActions }}</span>
            <span class="stat-label">Active Actions</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ criticalCount }}</span>
            <span class="stat-label" style="color: #d32f2f;">Critical</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ inProgressCount }}</span>
            <span class="stat-label">In Progress</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ completedCount }}</span>
            <span class="stat-label">Completed</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ adoptionRate }}%</span>
            <span class="stat-label">Adoption Rate</span>
          </div>
        </div>
      </div>

      <mat-card class="state-card" *ngIf="loading">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading recommended actions...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="state-card error" *ngIf="!loading && errorMessage">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadActions()">Retry</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && adoptionTelemetry.length">
        <mat-card-header>
          <mat-card-title>Adoption Trend History</mat-card-title>
          <mat-card-subtitle>
            24h change: <strong [class.positive]="adoptionDelta24h >= 0" [class.negative]="adoptionDelta24h < 0">
              {{ adoptionDelta24h >= 0 ? '+' : '' }}{{ adoptionDelta24h }}%
            </strong>
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="telemetry-window-row">
            <button
              mat-stroked-button
              type="button"
              *ngFor="let window of ['1h', '24h', '7d']"
              [class.window-active]="selectedTelemetryWindow === window"
              (click)="setTelemetryWindow(window)">
              {{ window }}
            </button>
          </div>

          <div class="telemetry-control-row" *ngIf="adoptionTelemetry.length >= 2" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
            <div class="telemetry-pan-row" style="display:flex;gap:8px;flex-wrap:wrap;">
              <button mat-stroked-button type="button" (click)="panTelemetryWindow('older')" [disabled]="!canPanTelemetryOlder()">
                Older
              </button>
              <button mat-stroked-button type="button" (click)="panTelemetryWindow('newer')" [disabled]="!canPanTelemetryNewer()">
                Newer
              </button>
            </div>
            <div class="telemetry-zoom-row" style="display:flex;gap:8px;flex-wrap:wrap;">
              <button
                mat-stroked-button
                type="button"
                *ngFor="let zoom of telemetryZoomLevels"
                [class.window-active]="telemetryZoomLevel === zoom"
                (click)="setTelemetryZoom(zoom)">
                {{ zoom }}x
              </button>
            </div>
          </div>

          <div class="telemetry-chart-shell" *ngIf="getTelemetryWindowPoints().length >= 2; else insufficientTrendData">
            <svg [attr.width]="chartWidth" [attr.height]="chartHeight" class="telemetry-chart" role="img" [attr.aria-label]="getTelemetryChartAriaLabel()">
              <line
                x1="4"
                [attr.y1]="chartHeight - 6"
                [attr.x2]="chartWidth - 4"
                [attr.y2]="chartHeight - 6"
                stroke="#d8d3f8"
                stroke-width="1"></line>
              <line
                x1="4"
                y1="6"
                x2="4"
                [attr.y2]="chartHeight - 6"
                stroke="#ece8ff"
                stroke-width="1"></line>
              <polyline
                *ngFor="let series of telemetrySeries; let first = first"
                [attr.points]="buildTelemetryPolyline(getTelemetryWindowPoints(), series.key)"
                fill="none"
                [attr.stroke]="series.color"
                [attr.stroke-width]="first ? 3 : 2"
                stroke-linecap="round"
                stroke-linejoin="round"
                [attr.stroke-opacity]="first ? 1 : 0.92"></polyline>
              <circle
                *ngFor="let chartPoint of getTelemetryChartPoints()"
                class="telemetry-point"
                [class.telemetry-point-active]="isActiveTelemetryPoint(chartPoint.point)"
                [attr.cx]="chartPoint.x"
                [attr.cy]="chartPoint.y"
                [attr.r]="isActiveTelemetryPoint(chartPoint.point) ? 5 : 4"
                tabindex="0"
                (mouseenter)="setHoveredTelemetryPoint(chartPoint.point)"
                (focus)="setHoveredTelemetryPoint(chartPoint.point)"
                (mouseleave)="clearHoveredTelemetryPoint()"
                (blur)="clearHoveredTelemetryPoint()">
              </circle>
            </svg>
            <div class="telemetry-legend-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;color:var(--ri-on-surface-variant);font-size:12px;">
              <span class="telemetry-legend-item" *ngFor="let series of telemetrySeries" style="display:inline-flex;align-items:center;gap:6px;">
                <span class="telemetry-legend-swatch" [style.background]="series.color" style="width:10px;height:10px;border-radius:999px;display:inline-block;"></span>
                {{ series.label }}
              </span>
            </div>
            <div class="telemetry-scale-row">
              <span>Low {{ getTelemetryWindowLowRate() }}%</span>
              <span>High {{ getTelemetryWindowPeakRate() }}%</span>
            </div>
            <div class="telemetry-axis-row">
              <span>{{ getTelemetryWindowStartLabel() }}</span>
              <span>{{ getTelemetryWindowEndLabel() }}</span>
            </div>
            <div class="telemetry-chart-meta">
              <span>{{ getTelemetryViewSummary() }}</span>
              <span>Start {{ getTelemetryWindowStartRate() }}%</span>
              <span>Peak {{ getTelemetryWindowPeakRate() }}%</span>
              <span>Current {{ adoptionRate }}%</span>
            </div>
            <div class="telemetry-tooltip" *ngIf="getActiveTelemetryPoint() as activePoint">
              <strong>{{ activePoint.adoptionRate }}% adoption</strong>
              <span>{{ formatDateTime(activePoint.timestamp) }}</span>
              <span>Completed {{ getTelemetryRateForPoint(activePoint, 'completed') }}% · In Progress {{ getTelemetryRateForPoint(activePoint, 'inProgress') }}%</span>
              <span>{{ activePoint.completedCount }} completed · {{ activePoint.inProgressCount }} in progress · {{ activePoint.openCount }} open</span>
            </div>
          </div>

          <ng-template #insufficientTrendData>
            <p class="telemetry-hint">Not enough telemetry points for chart view in this window yet.</p>
          </ng-template>

          <div class="telemetry-list">
            <div class="telemetry-row" *ngFor="let point of getTelemetryTimelinePoints()">
              <span class="telemetry-time">{{ formatDateTime(point.timestamp) }}</span>
              <span class="telemetry-rate">{{ point.adoptionRate }}%</span>
              <span class="telemetry-meta">{{ point.completedCount }} completed · {{ point.inProgressCount }} in progress</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-tab-group *ngIf="!loading && !errorMessage" animationDuration="300">
        <mat-tab label="All Actions ({{ filteredActions('open').length }})">
          <div class="tab-content">
            <div class="action-list">
              <mat-card class="action-card" *ngFor="let action of filteredActions('open')">
                <mat-card-header>
                  <div class="action-header">
                    <div class="project-info">
                      <strong>{{ action.projectName }}</strong>
                      <span class="anomaly-id">Anomaly: {{ action.anomalyId }}</span>
                    </div>
                    <mat-chip-set>
                      <mat-chip [ngClass]="'severity-' + action.severity.toLowerCase()">
                        {{ action.severity }}
                      </mat-chip>
                      <mat-chip class="category-chip">
                        {{ action.category }}
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  <p class="action-description">{{ action.description }}</p>
                  <div class="action-meta">
                    <span class="timestamp">
                      <mat-icon>schedule</mat-icon>
                      {{ formatDate(action.generatedAt) }}
                    </span>
                  </div>
                </mat-card-content>
                <mat-card-footer>
                  <button mat-stroked-button type="button" (click)="markInProgress(action)">Start Work</button>
                  <button mat-stroked-button type="button" (click)="markCompleted(action)">Mark Completed</button>
                </mat-card-footer>
              </mat-card>

              <mat-card class="empty-state" *ngIf="filteredActions('open').length === 0">
                <mat-card-content>
                  <p>No open actions at this time. Great work on delivery health!</p>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="In Progress ({{ filteredActions('in_progress').length }})">
          <div class="tab-content">
            <div class="action-list">
              <mat-card class="action-card" *ngFor="let action of filteredActions('in_progress')">
                <mat-card-header>
                  <div class="action-header">
                    <div class="project-info">
                      <strong>{{ action.projectName }}</strong>
                      <span class="anomaly-id">Anomaly: {{ action.anomalyId }}</span>
                    </div>
                    <mat-chip-set>
                      <mat-chip [ngClass]="'severity-' + action.severity.toLowerCase()">
                        {{ action.severity }}
                      </mat-chip>
                      <mat-chip class="category-chip">
                        {{ action.category }}
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  <p class="action-description">{{ action.description }}</p>
                  <div class="action-meta">
                    <span class="timestamp"><mat-icon>schedule</mat-icon>{{ formatDate(action.generatedAt) }}</span>
                  </div>
                </mat-card-content>
                <mat-card-footer>
                  <button mat-stroked-button type="button" (click)="markCompleted(action)">Mark Completed</button>
                  <button mat-stroked-button type="button" (click)="markOpen(action)">Revert to Open</button>
                </mat-card-footer>
              </mat-card>

              <mat-card class="empty-state" *ngIf="filteredActions('in_progress').length === 0">
                <mat-card-content>
                  <p>No actions currently in progress.</p>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Completed ({{ filteredActions('completed').length }})">
          <div class="tab-content">
            <div class="action-list">
              <mat-card class="action-card completed" *ngFor="let action of filteredActions('completed')">
                <mat-card-header>
                  <div class="action-header">
                    <div class="project-info">
                      <strong>{{ action.projectName }}</strong>
                      <span class="anomaly-id">Anomaly: {{ action.anomalyId }}</span>
                    </div>
                    <mat-chip-set>
                      <mat-chip class="completed-chip">
                        <mat-icon>check_circle</mat-icon> Completed
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  <p class="action-description">{{ action.description }}</p>
                  <div class="action-meta">
                    <span class="timestamp"><mat-icon>schedule</mat-icon>{{ formatDate(action.generatedAt) }}</span>
                  </div>
                </mat-card-content>
                <mat-card-footer>
                  <button mat-stroked-button type="button" (click)="markOpen(action)">Reopen</button>
                </mat-card-footer>
              </mat-card>

              <mat-card class="empty-state" *ngIf="filteredActions('completed').length === 0">
                <mat-card-content>
                  <p>No completed actions yet.</p>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1400px;
    }

    h1 {
      margin: 0 0 8px 0;
    }

    .subtitle {
      color: var(--ri-on-surface-variant);
      margin: 0 0 24px 0;
      font-size: 14px;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .stats-row {
      display: flex;
      gap: 24px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      border: 1px solid var(--ri-outline);
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--ri-primary);
    }

    .stat-label {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
      margin-top: 4px;
    }

    .state-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .section-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .positive {
      color: #2e7d32;
    }

    .negative {
      color: #ba1a1a;
    }

    .telemetry-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }

    .telemetry-window-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .telemetry-window-row {
      margin-bottom: 12px;
    }

    .window-active {
      background: rgba(53, 37, 205, 0.1);
      border-color: #3525cd;
      color: #3525cd;
    }

    .telemetry-chart-shell {
      border: 1px solid var(--ri-outline-variant);
      border-radius: 8px;
      background: #fbfaff;
      padding: 12px;
    }

    .telemetry-chart {
      width: 100%;
      max-width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }

    .telemetry-point {
      fill: white;
      stroke: #3525cd;
      stroke-width: 2;
      cursor: pointer;
    }

    .telemetry-point:hover,
    .telemetry-point:focus,
    .telemetry-point-active {
      fill: #3525cd;
      outline: none;
    }

    .telemetry-scale-row,
    .telemetry-axis-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 11px;
      color: var(--ri-on-surface-variant);
      margin-top: 6px;
    }

    .telemetry-chart-meta {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .telemetry-tooltip {
      margin-top: 10px;
      display: grid;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(53, 37, 205, 0.08);
      color: var(--ri-on-surface);
      font-size: 12px;
    }

    .telemetry-hint {
      margin: 0;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .telemetry-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 8px;
      padding: 8px 10px;
      background: var(--ri-surface-container);
      flex-wrap: wrap;
    }

    .telemetry-time {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
      min-width: 140px;
    }

    .telemetry-rate {
      font-size: 13px;
      font-weight: 700;
      color: var(--ri-primary);
    }

    .telemetry-meta {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .state-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px 20px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .action-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .action-card {
      background: white;
      border-radius: 8px;
      border-left: 4px solid var(--ri-primary);
    }

    .action-card.completed {
      opacity: 0.7;
      border-left-color: #4caf50;
    }

    .action-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }

    .project-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .project-info strong {
      font-size: 14px;
      color: var(--ri-on-surface);
    }

    .anomaly-id {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    mat-chip-set {
      display: flex;
      gap: 8px;
    }

    mat-chip {
      font-size: 12px;
      padding: 4px 8px;
    }

    mat-chip.severity-critical {
      background: #d32f2f;
      color: white;
    }

    mat-chip.severity-high {
      background: #f57c00;
      color: white;
    }

    mat-chip.severity-medium {
      background: #fbc02d;
      color: #333;
    }

    mat-chip.severity-low {
      background: #388e3c;
      color: white;
    }

    mat-chip.category-chip {
      background: var(--ri-surface-variant);
      color: var(--ri-on-surface-variant);
    }

    mat-chip.completed-chip {
      background: #4caf50;
      color: white;
    }

    .action-description {
      font-size: 14px;
      color: var(--ri-on-surface);
      margin: 12px 0;
      line-height: 1.5;
    }

    .action-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .action-meta mat-icon {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }

    .timestamp {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    mat-card-footer {
      display: flex;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--ri-outline);
    }

    .empty-state {
      background: white;
      border-radius: 8px;
      text-align: center;
      color: var(--ri-on-surface-variant);
      padding: 40px 20px;
    }

    ::ng-deep .mat-mdc-tab-labels {
      margin-bottom: 0;
    }
  `],
})
export class ActionsComponent implements OnInit {
  private readonly statusStorageKey = 'ri-action-status-v1';
  private readonly telemetryStorageKey = 'ri-action-telemetry-v1';
  private readonly maxTelemetryPoints = 180;
  private readonly denseRecentTelemetryPoints = 60;
  private readonly historicalTelemetryStride = 3;
  readonly chartWidth = 420;
  readonly chartHeight = 120;

  loading = true;
  errorMessage = '';
  allActions: RecommendedAction[] = [];
  actionStatuses = new Map<string, 'open' | 'in_progress' | 'completed'>();

  totalActions = 0;
  criticalCount = 0;
  inProgressCount = 0;
  completedCount = 0;
  adoptionRate = 0;
  adoptionDelta24h = 0;
  adoptionTelemetry: AdoptionTelemetryPoint[] = [];
  selectedTelemetryWindow: TelemetryWindow = '24h';
  hoveredTelemetryPoint: AdoptionTelemetryPoint | null = null;
  telemetryZoomLevel: TelemetryZoomLevel = 1;
  telemetryPanOffsetSteps = 0;
  readonly telemetrySeries: TelemetrySeriesDefinition[] = [
    { key: 'adoption', label: 'Adoption', color: '#3525cd' },
    { key: 'completed', label: 'Completed', color: '#0f9d58' },
    { key: 'inProgress', label: 'In Progress', color: '#ff8f00' },
  ];
  readonly telemetryZoomLevels: TelemetryZoomLevel[] = [1, 2, 4];

  constructor(
    private riskService: RiskService,
    private projectsService: ProjectsService
  ) {}

  ngOnInit(): void {
    this.adoptionTelemetry = this.readTelemetry();
    this.updateAdoptionDelta24h();
    this.syncActiveTelemetryPoint();
    this.loadActions();
  }

  loadActions(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      projects: this.projectsService.getProjects().pipe(
        catchError((err) => {
          console.error('Projects load error:', err);
          return of({});
        })
      ),
      anomalies: this.riskService.getPortfolioAnomalies().pipe(
        catchError((err) => {
          console.error('Anomalies load error:', err);
          return of([]);
        })
      ),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (data) => {
          const projectsData = data.projects;
          const anomalies: ProjectAnomaly[] = data.anomalies;

          this.buildActionList(projectsData, anomalies);
          this.updateStats();
        },
        error: (err) => {
          this.errorMessage = 'Failed to load recommended actions. Please try again.';
          console.error('Action load error:', err);
        },
      });
  }

  private buildActionList(projectsData: any, anomalies: ProjectAnomaly[]): void {
    this.allActions = [];
    const persistedStatuses = this.readStoredStatuses();
    this.actionStatuses = new Map<string, 'open' | 'in_progress' | 'completed'>();

    const projects = Array.isArray(projectsData) ? projectsData : (projectsData?.projects || []);
    const projectMap = new Map((projects || []).map((p: ProjectItem) => [p.id, p]));

    let actionIndex = 0;
    for (const anomaly of anomalies) {
      const project = projectMap.get(anomaly.projectId) as ProjectItem | undefined;
      if (!project || !project.name) continue;

      const recommendations = getRecommendedActionsForAnomaly(anomaly);
      for (const [index, description] of recommendations.entries()) {
        const action: RecommendedAction = {
          id: `${anomaly.projectId}-${actionIndex}-${index}`,
          projectId: anomaly.projectId,
          projectName: project.name,
          anomalyId: anomaly.projectId,
          description,
          severity: anomaly.severity as any,
          category: this.categorizeAction(description),
          source: this.categorizeSource(description),
          generatedAt: Date.now(),
          status: 'open',
        };

        this.allActions.push(action);
        this.actionStatuses.set(action.id, persistedStatuses.get(action.id) || 'open');
      }
      actionIndex++;
    }

    this.allActions.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    this.persistStatuses();
  }

  private categorizeAction(description: string): string {
    if (description.includes('Escalate')) return 'Escalation';
    if (description.includes('Freeze')) return 'Scope Control';
    if (description.includes('Increase monitoring')) return 'Monitoring';
    if (description.includes('Preserve') || description.includes('improvements hold')) return 'Tracking';
    if (description.includes('root-cause')) return 'Root Cause';
    return 'General';
  }

  private categorizeSource(description: string): RecommendedAction['source'] {
    if (description.includes('Escalate')) return 'severity_escalation';
    if (description.includes('Freeze') || description.includes('monitoring')) return 'trend_management';
    if (description.includes('root-cause')) return 'event_review';
    return 'tracking';
  }

  filteredActions(status: 'open' | 'in_progress' | 'completed'): RecommendedAction[] {
    return this.allActions.filter(a => this.actionStatuses.get(a.id) === status);
  }

  markInProgress(action: RecommendedAction): void {
    this.actionStatuses.set(action.id, 'in_progress');
    this.persistStatuses();
    this.updateStats();
  }

  markCompleted(action: RecommendedAction): void {
    this.actionStatuses.set(action.id, 'completed');
    this.persistStatuses();
    this.updateStats();
  }

  markOpen(action: RecommendedAction): void {
    this.actionStatuses.set(action.id, 'open');
    this.persistStatuses();
    this.updateStats();
  }

  private updateStats(): void {
    const total = this.allActions.length;
    this.totalActions = this.filteredActions('open').length;
    this.inProgressCount = this.filteredActions('in_progress').length;
    this.criticalCount = this.allActions.filter(
      a => a.severity === 'CRITICAL' && this.actionStatuses.get(a.id) === 'open'
    ).length;
    this.completedCount = this.filteredActions('completed').length;
    this.adoptionRate = total ? Math.round(((this.inProgressCount + this.completedCount) / total) * 100) : 0;

    this.captureTelemetrySnapshot();
    this.updateAdoptionDelta24h();
    this.syncActiveTelemetryPoint();
  }

  private readStoredStatuses(): Map<string, 'open' | 'in_progress' | 'completed'> {
    if (typeof localStorage === 'undefined') {
      return new Map<string, 'open' | 'in_progress' | 'completed'>();
    }

    try {
      const raw = localStorage.getItem(this.statusStorageKey);
      if (!raw) {
        return new Map<string, 'open' | 'in_progress' | 'completed'>();
      }

      const parsed = JSON.parse(raw) as Record<string, 'open' | 'in_progress' | 'completed'>;
      return new Map<string, 'open' | 'in_progress' | 'completed'>(Object.entries(parsed));
    } catch {
      return new Map<string, 'open' | 'in_progress' | 'completed'>();
    }
  }

  private persistStatuses(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const validActionIds = new Set(this.allActions.map((action) => action.id));
    const compacted: Record<string, 'open' | 'in_progress' | 'completed'> = {};

    this.actionStatuses.forEach((status, actionId) => {
      if (validActionIds.has(actionId)) {
        compacted[actionId] = status;
      }
    });

    try {
      localStorage.setItem(this.statusStorageKey, JSON.stringify(compacted));
    } catch {
      // Ignore storage failures to keep UI responsive in constrained environments.
    }
  }

  private readTelemetry(): AdoptionTelemetryPoint[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.telemetryStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as AdoptionTelemetryPoint[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return this.compactTelemetry(
        parsed.filter((point) => typeof point.timestamp === 'number' && typeof point.adoptionRate === 'number')
      );
    } catch {
      return [];
    }
  }

  private persistTelemetry(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.telemetryStorageKey, JSON.stringify(this.compactTelemetry(this.adoptionTelemetry)));
    } catch {
      // Ignore storage failures and continue rendering without telemetry persistence.
    }
  }

  private captureTelemetrySnapshot(): void {
    if (!this.allActions.length) {
      return;
    }

    const currentPoint: AdoptionTelemetryPoint = {
      timestamp: Date.now(),
      openCount: this.totalActions,
      inProgressCount: this.inProgressCount,
      completedCount: this.completedCount,
      adoptionRate: this.adoptionRate,
    };

    const previousPoint = this.adoptionTelemetry[this.adoptionTelemetry.length - 1];
    if (
      previousPoint
      && previousPoint.openCount === currentPoint.openCount
      && previousPoint.inProgressCount === currentPoint.inProgressCount
      && previousPoint.completedCount === currentPoint.completedCount
      && previousPoint.adoptionRate === currentPoint.adoptionRate
    ) {
      return;
    }

    this.adoptionTelemetry = this.compactTelemetry([...this.adoptionTelemetry, currentPoint]);
    this.persistTelemetry();
  }

  private compactTelemetry(points: AdoptionTelemetryPoint[]): AdoptionTelemetryPoint[] {
    if (points.length <= this.maxTelemetryPoints) {
      return [...points];
    }

    const denseRecent = points.slice(-this.denseRecentTelemetryPoints);
    const olderPoints = points.slice(0, -this.denseRecentTelemetryPoints);
    const compactedOlderPoints = olderPoints.filter((_, index) => (
      index === 0
      || index === olderPoints.length - 1
      || index % this.historicalTelemetryStride === 0
    ));

    return [...compactedOlderPoints, ...denseRecent].slice(-this.maxTelemetryPoints);
  }

  private updateAdoptionDelta24h(): void {
    if (!this.adoptionTelemetry.length) {
      this.adoptionDelta24h = 0;
      return;
    }

    const latest = this.adoptionTelemetry[this.adoptionTelemetry.length - 1];
    const threshold = latest.timestamp - 24 * 60 * 60 * 1000;
    const baseline = this.adoptionTelemetry.find((point) => point.timestamp >= threshold) || this.adoptionTelemetry[0];
    this.adoptionDelta24h = latest.adoptionRate - baseline.adoptionRate;
  }

  setTelemetryWindow(window: string): void {
    if (window === '1h' || window === '24h' || window === '7d') {
      this.selectedTelemetryWindow = window;
      this.telemetryPanOffsetSteps = 0;
      this.syncActiveTelemetryPoint();
    }
  }

  setTelemetryZoom(zoom: number): void {
    if (zoom === 1 || zoom === 2 || zoom === 4) {
      this.telemetryZoomLevel = zoom;
      this.clampTelemetryPanOffset();
      this.syncActiveTelemetryPoint();
    }
  }

  panTelemetryWindow(direction: 'older' | 'newer'): void {
    const nextOffset = direction === 'older'
      ? this.telemetryPanOffsetSteps + 1
      : this.telemetryPanOffsetSteps - 1;

    this.telemetryPanOffsetSteps = Math.max(0, Math.min(this.getMaxTelemetryPanOffsetSteps(), nextOffset));
    this.syncActiveTelemetryPoint();
  }

  canPanTelemetryOlder(): boolean {
    return this.telemetryPanOffsetSteps < this.getMaxTelemetryPanOffsetSteps();
  }

  canPanTelemetryNewer(): boolean {
    return this.telemetryPanOffsetSteps > 0;
  }

  getTelemetryWindowPoints(): AdoptionTelemetryPoint[] {
    if (!this.adoptionTelemetry.length) {
      return [];
    }

    const range = this.getTelemetryViewRange();
    const filtered = this.adoptionTelemetry.filter(
      (point) => point.timestamp >= range.start && point.timestamp <= range.end
    );

    if (filtered.length >= 2) {
      return filtered;
    }

    const contextualPoints = this.getTelemetryContextPoints(range.start, range.end, filtered);
    if (contextualPoints.length >= 2) {
      return contextualPoints;
    }

    const closestPoint = [...this.adoptionTelemetry]
      .reverse()
      .find((point) => point.timestamp <= range.end)
      || this.adoptionTelemetry[0];

    return closestPoint ? [closestPoint] : [];
  }

  getTelemetryChartPoints(): TelemetryChartPoint[] {
    return this.buildTelemetryChartPoints(this.getTelemetryWindowPoints(), 'adoption');
  }

  getTelemetryTimelinePoints(): AdoptionTelemetryPoint[] {
    return [...this.getTelemetryWindowPoints()].slice(-7).reverse();
  }

  buildTelemetryPolyline(points: AdoptionTelemetryPoint[], series: TelemetrySeriesKey = 'adoption'): string {
    const chartPoints = this.buildTelemetryChartPoints(points, series);
    if (chartPoints.length < 2) {
      return '';
    }

    return chartPoints
      .map((point) => `${Math.round(point.x)},${Math.round(point.y)}`)
      .join(' ');
  }

  getTelemetryWindowLowRate(): number {
    const points = this.getTelemetryWindowPoints();
    return points.length ? Math.min(...points.map((point) => this.getTelemetryRateForPoint(point, 'adoption'))) : 0;
  }

  getTelemetryWindowStartRate(): number {
    const points = this.getTelemetryWindowPoints();
    return points.length ? points[0].adoptionRate : 0;
  }

  getTelemetryWindowPeakRate(): number {
    const points = this.getTelemetryWindowPoints();
    return points.length ? Math.max(...points.map((point) => this.getTelemetryRateForPoint(point, 'adoption'))) : 0;
  }

  getTelemetryRateForPoint(point: AdoptionTelemetryPoint, series: TelemetrySeriesKey): number {
    const total = point.openCount + point.inProgressCount + point.completedCount;
    if (!total) {
      return 0;
    }

    if (series === 'completed') {
      return Math.round((point.completedCount / total) * 100);
    }

    if (series === 'inProgress') {
      return Math.round((point.inProgressCount / total) * 100);
    }

    return point.adoptionRate;
  }

  getTelemetryWindowStartLabel(): string {
    const points = this.getTelemetryWindowPoints();
    return points.length ? this.formatTime(points[0].timestamp) : '--';
  }

  getTelemetryWindowEndLabel(): string {
    const points = this.getTelemetryWindowPoints();
    return points.length ? this.formatTime(points[points.length - 1].timestamp) : '--';
  }

  getTelemetryViewSummary(): string {
    return `${this.telemetryZoomLevel}x zoom${this.telemetryPanOffsetSteps ? ` · shifted ${this.telemetryPanOffsetSteps} step${this.telemetryPanOffsetSteps > 1 ? 's' : ''} older` : ' · live edge'}`;
  }

  setHoveredTelemetryPoint(point: AdoptionTelemetryPoint): void {
    this.hoveredTelemetryPoint = point;
  }

  clearHoveredTelemetryPoint(): void {
    const points = this.getTelemetryWindowPoints();
    this.hoveredTelemetryPoint = points[points.length - 1] ?? null;
  }

  getActiveTelemetryPoint(): AdoptionTelemetryPoint | null {
    const points = this.getTelemetryWindowPoints();
    if (!points.length) {
      return null;
    }

    if (this.hoveredTelemetryPoint && points.some((point) => point.timestamp === this.hoveredTelemetryPoint?.timestamp)) {
      return this.hoveredTelemetryPoint;
    }

    return points[points.length - 1];
  }

  isActiveTelemetryPoint(point: AdoptionTelemetryPoint): boolean {
    return this.getActiveTelemetryPoint()?.timestamp === point.timestamp;
  }

  getTelemetryChartAriaLabel(): string {
    const activePoint = this.getActiveTelemetryPoint();
    if (!activePoint) {
      return 'Adoption trend chart';
    }

    return `Adoption trend chart from ${this.getTelemetryWindowStartLabel()} to ${this.getTelemetryWindowEndLabel()} at ${this.telemetryZoomLevel}x zoom, current highlighted point ${activePoint.adoptionRate} percent adoption with ${this.getTelemetryRateForPoint(activePoint, 'completed')} percent completed and ${this.getTelemetryRateForPoint(activePoint, 'inProgress')} percent in progress at ${this.formatDateTime(activePoint.timestamp)}`;
  }

  private getWindowDurationMs(window: TelemetryWindow): number {
    if (window === '1h') {
      return 60 * 60 * 1000;
    }

    if (window === '24h') {
      return 24 * 60 * 60 * 1000;
    }

    return 7 * 24 * 60 * 60 * 1000;
  }

  private getTelemetryViewRange(): { start: number; end: number } {
    const latestTimestamp = this.adoptionTelemetry[this.adoptionTelemetry.length - 1].timestamp;
    const earliestTimestamp = this.adoptionTelemetry[0].timestamp;
    const duration = this.getTelemetryViewDurationMs();
    const panShift = this.telemetryPanOffsetSteps * this.getTelemetryPanStepMs();

    let end = latestTimestamp - panShift;
    let start = end - duration;

    if (start < earliestTimestamp) {
      start = earliestTimestamp;
      end = earliestTimestamp + duration;
    }

    if (end > latestTimestamp) {
      end = latestTimestamp;
      start = latestTimestamp - duration;
    }

    return {
      start,
      end,
    };
  }

  private getTelemetryContextPoints(
    start: number,
    end: number,
    inRangePoints: AdoptionTelemetryPoint[]
  ): AdoptionTelemetryPoint[] {
    const points = [...inRangePoints];
    const before = [...this.adoptionTelemetry].reverse().find((point) => point.timestamp < start);
    const after = this.adoptionTelemetry.find((point) => point.timestamp > end);

    if (before && !points.some((point) => point.timestamp === before.timestamp)) {
      points.unshift(before);
    }

    if (after && !points.some((point) => point.timestamp === after.timestamp)) {
      points.push(after);
    }

    return points;
  }

  private getTelemetryViewDurationMs(): number {
    return Math.max(Math.floor(this.getWindowDurationMs(this.selectedTelemetryWindow) / this.telemetryZoomLevel), 5 * 60 * 1000);
  }

  private getTelemetryPanStepMs(): number {
    return Math.max(Math.floor(this.getTelemetryViewDurationMs() / 2), 60 * 1000);
  }

  private getMaxTelemetryPanOffsetSteps(): number {
    if (this.adoptionTelemetry.length < 2) {
      return 0;
    }

    const latestTimestamp = this.adoptionTelemetry[this.adoptionTelemetry.length - 1].timestamp;
    const earliestTimestamp = this.adoptionTelemetry[0].timestamp;
    const availableHistory = Math.max(latestTimestamp - earliestTimestamp - this.getTelemetryViewDurationMs(), 0);
    return Math.ceil(availableHistory / this.getTelemetryPanStepMs());
  }

  private clampTelemetryPanOffset(): void {
    this.telemetryPanOffsetSteps = Math.min(this.telemetryPanOffsetSteps, this.getMaxTelemetryPanOffsetSteps());
  }

  private buildTelemetryChartPoints(points: AdoptionTelemetryPoint[], series: TelemetrySeriesKey): TelemetryChartPoint[] {
    if (!points.length) {
      return [];
    }

    const seriesRates = points.map((point) => this.getTelemetryRateForPoint(point, series));
    const minRate = Math.min(...seriesRates);
    const maxRate = Math.max(...seriesRates);
    const rateSpan = Math.max(maxRate - minRate, 1);

    const firstTs = points[0].timestamp;
    const lastTs = points[points.length - 1].timestamp;
    const tsSpan = Math.max(lastTs - firstTs, 1);

    return points.map((point) => {
      const rate = this.getTelemetryRateForPoint(point, series);
      const x = ((point.timestamp - firstTs) / tsSpan) * (this.chartWidth - 8) + 4;
      const y = this.chartHeight - (((rate - minRate) / rateSpan) * (this.chartHeight - 12) + 6);
      return {
        x,
        y,
        point,
      };
    });
  }

  private syncActiveTelemetryPoint(): void {
    const points = this.getTelemetryWindowPoints();
    if (!points.length) {
      this.hoveredTelemetryPoint = null;
      return;
    }

    if (!this.hoveredTelemetryPoint || !points.some((point) => point.timestamp === this.hoveredTelemetryPoint?.timestamp)) {
      this.hoveredTelemetryPoint = points[points.length - 1];
    }
  }

  formatDate(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }

  formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}
