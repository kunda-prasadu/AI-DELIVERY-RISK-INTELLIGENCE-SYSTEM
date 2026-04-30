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
            <span class="stat-value">{{ completedCount }}</span>
            <span class="stat-label">Completed</span>
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
  loading = true;
  errorMessage = '';
  allActions: RecommendedAction[] = [];
  actionStatuses = new Map<string, 'open' | 'in_progress' | 'completed'>();

  totalActions = 0;
  criticalCount = 0;
  completedCount = 0;

  constructor(
    private riskService: RiskService,
    private projectsService: ProjectsService
  ) {}

  ngOnInit(): void {
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
        this.actionStatuses.set(action.id, 'open');
      }
      actionIndex++;
    }

    this.allActions.sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private categorizeAction(description: string): string {
    if (description.includes('Escalate')) return 'Escalation';
    if (description.includes('Freeze')) return 'Scope Control';
    if (description.includes('Increase monitoring')) return 'Monitoring';
    if (description.includes('Preserve') || description.includes('improvements hold')) return 'Tracking';
    if (description.includes('root-cause')) return 'Root Cause';
    return 'General';
  }

  private categorizeSource(description: string): any {
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
    this.updateStats();
  }

  markCompleted(action: RecommendedAction): void {
    this.actionStatuses.set(action.id, 'completed');
    this.updateStats();
  }

  markOpen(action: RecommendedAction): void {
    this.actionStatuses.set(action.id, 'open');
    this.updateStats();
  }

  private updateStats(): void {
    this.totalActions = this.filteredActions('open').length;
    this.criticalCount = this.allActions.filter(
      a => a.severity === 'CRITICAL' && this.actionStatuses.get(a.id) === 'open'
    ).length;
    this.completedCount = this.filteredActions('completed').length;
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
}
