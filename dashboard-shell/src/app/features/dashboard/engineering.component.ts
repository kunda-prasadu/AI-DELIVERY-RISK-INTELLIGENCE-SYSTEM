import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ProjectItem, ProjectsService } from '../../shared/services/projects.service';
import { PortfolioAnomalySummary, ProjectAnomaly, RiskScore, RiskService } from '../../shared/services/risk.service';
import { FeedbackService, FeedbackSignal, LearningSummary, SubmitFeedbackPayload } from '../../shared/services/feedback.service';

interface EngineeringHotspot {
  projectId: string;
  projectName: string;
  team: string;
  riskScore: number;
  riskBand: RiskScore['band'];
  anomalySeverity: ProjectAnomaly['severity'] | 'NONE';
  anomalyTrend: ProjectAnomaly['trend'] | 'none';
  criticalEvents: number;
  dominantSignal: 'quality' | 'cicd' | 'codeVelocity' | 'jiraVelocity';
}

@Component({
  selector: 'app-engineering',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Engineering Insights</h1>
      <p class="subtitle">Portfolio-level engineering health signals, hotspot repositories, and remediation priorities.</p>

      <div class="toolbar-row">
        <p class="summary" *ngIf="!loading && !errorMessage">
          Tracking {{ hotspots.length }} delivery tracks from live risk and anomaly data.
        </p>
        <button mat-stroked-button type="button" (click)="loadInsights()" [disabled]="loading">Refresh</button>
      </div>

      <mat-card class="state-card" *ngIf="loading">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading engineering insights...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="state-card error" *ngIf="!loading && errorMessage">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadInsights()">Try Again</button>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="stats-grid" *ngIf="!loading && !errorMessage && hotspots.length">
        <mat-card class="stat-card pressure">
          <mat-card-content>
            <p class="stat-value">{{ deliveryPressure }}</p>
            <p class="stat-label">Delivery Pressure</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card critical">
          <mat-card-content>
            <p class="stat-value">{{ highRiskCount }}</p>
            <p class="stat-label">High/Critical Repos</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card trend">
          <mat-card-content>
            <p class="stat-value">{{ regressionCount }}</p>
            <p class="stat-label">Regression Signals</p>
          </mat-card-content>
        </mat-card>
        <mat-card class="stat-card events">
          <mat-card-content>
            <p class="stat-value">{{ criticalEventCount }}</p>
            <p class="stat-label">Critical Events</p>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && anomalySummary">
        <mat-card-header>
          <mat-card-title>Model Monitoring Dashboard</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="stats-grid" style="margin-bottom: 0;">
            <mat-card class="stat-card pressure">
              <mat-card-content>
                <p class="stat-value">{{ modelHealthIndex }}%</p>
                <p class="stat-label">Model Health Index</p>
              </mat-card-content>
            </mat-card>
            <mat-card class="stat-card trend">
              <mat-card-content>
                <p class="stat-value">{{ anomalySummary.escalatedCount }}</p>
                <p class="stat-label">Escalated Signals</p>
              </mat-card-content>
            </mat-card>
            <mat-card class="stat-card critical">
              <mat-card-content>
                <p class="stat-value">{{ anomalySummary.criticalCount }}</p>
                <p class="stat-label">Critical Anomalies</p>
              </mat-card-content>
            </mat-card>
            <mat-card class="stat-card events">
              <mat-card-content>
                <p class="stat-value">{{ escalatedSignalRatio }}%</p>
                <p class="stat-label">Escalation Ratio</p>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && hotspots.length">
        <mat-card-header>
          <mat-card-title>Top Hotspot Repositories</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="hotspot-list">
            <div class="hotspot-row" *ngFor="let hotspot of hotspots.slice(0, 6)">
              <div class="hotspot-main">
                <span class="project-name">{{ hotspot.projectName }}</span>
                <p class="project-meta">{{ hotspot.team }} · {{ hotspot.projectId }}</p>
                <p class="project-meta">Dominant signal: {{ hotspot.dominantSignal }}</p>
              </div>
              <div class="hotspot-chips">
                <span class="chip score">{{ hotspot.riskScore }}</span>
                <span class="chip" [class]="'band-' + hotspot.riskBand.toLowerCase()">{{ hotspot.riskBand }}</span>
                <span class="chip" [class]="'severity-' + hotspot.anomalySeverity.toLowerCase()">{{ hotspot.anomalySeverity }}</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="watchlist-grid" *ngIf="!loading && !errorMessage && hotspots.length">
        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Reliability Watchlist</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p *ngIf="!reliabilityWatchlist.length">No reliability hotspots detected.</p>
            <ul class="watchlist" *ngIf="reliabilityWatchlist.length">
              <li *ngFor="let item of reliabilityWatchlist">
                <span>{{ item.projectName }}</span>
                <span class="watch-meta">CI/CD stress + anomaly trend {{ item.anomalyTrend }}</span>
              </li>
            </ul>
          </mat-card-content>
        </mat-card>

        <mat-card class="section-card">
          <mat-card-header>
            <mat-card-title>Quality Drift Radar</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <p *ngIf="!qualityDrift.length">No quality drift hotspots detected.</p>
            <ul class="watchlist" *ngIf="qualityDrift.length">
              <li *ngFor="let item of qualityDrift">
                <span>{{ item.projectName }}</span>
                <span class="watch-meta">Quality pressure + score {{ item.riskScore }}</span>
              </li>
            </ul>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card class="state-card" *ngIf="!loading && !errorMessage && !hotspots.length">
        <mat-card-content>
          <div class="state-content">
            <p>No engineering insights are available yet.</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- ── Feedback Loop & Learning Panel ──────────────────────── -->
      <mat-card class="section-card">
        <mat-card-header>
          <mat-card-title>Feedback Loop &amp; Learning Signals</mat-card-title>
          <mat-card-subtitle>Submit feedback on model outputs and view acceptance trends</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="insights-controls-row" style="margin-bottom:16px;flex-wrap:wrap;gap:10px;">
            <label>Target Type
              <select [value]="feedbackTargetType" (change)="feedbackTargetType = $any($event.target).value">
                <option value="recommendation">Recommendation</option>
                <option value="insight">Insight</option>
                <option value="anomaly">Anomaly</option>
                <option value="report">Report</option>
              </select>
            </label>
            <label>Target ID
              <input type="text" [value]="feedbackTargetId" (input)="feedbackTargetId = $any($event.target).value" placeholder="e.g. rec-123" style="padding:4px 8px;border:1px solid var(--ri-outline);border-radius:4px;font-size:13px;background:var(--ri-surface);color:inherit;" />
            </label>
            <label>Signal
              <select [value]="feedbackSignal" (change)="feedbackSignal = $any($event.target).value">
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="deferred">Deferred</option>
                <option value="corrected">Corrected</option>
              </select>
            </label>
            <label>Comment
              <input type="text" [value]="feedbackComment" (input)="feedbackComment = $any($event.target).value" placeholder="Optional comment" style="padding:4px 8px;border:1px solid var(--ri-outline);border-radius:4px;font-size:13px;background:var(--ri-surface);color:inherit;" />
            </label>
            <button mat-flat-button type="button" color="primary" (click)="submitFeedback()" [disabled]="feedbackSubmitting || !feedbackTargetId">
              {{ feedbackSubmitting ? 'Submitting...' : 'Submit Feedback' }}
            </button>
            <button mat-stroked-button type="button" (click)="loadLearning()" [disabled]="learningLoading">Refresh Learning</button>
          </div>

          <p *ngIf="feedbackSuccessMsg" style="color:#388e3c;font-size:13px;margin:0 0 12px;">{{ feedbackSuccessMsg }}</p>
          <p *ngIf="feedbackErrorMsg" style="color:#b3261e;font-size:13px;margin:0 0 12px;">{{ feedbackErrorMsg }}</p>

          <div class="state-content" *ngIf="learningLoading">
            <mat-spinner diameter="24"></mat-spinner>
          </div>

          <div *ngIf="!learningLoading && learningSummary">
            <div class="stats-grid" style="margin-bottom:16px;">
              <mat-card class="stat-card pressure">
                <mat-card-content>
                  <p class="stat-value">{{ learningSummary.total }}</p>
                  <p class="stat-label">Total Feedback</p>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card trend">
                <mat-card-content>
                  <p class="stat-value">{{ learningSummary.acceptanceRate }}%</p>
                  <p class="stat-label">Acceptance Rate</p>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card critical">
                <mat-card-content>
                  <p class="stat-value">{{ learningSummary.rejectionRate }}%</p>
                  <p class="stat-label">Rejection Rate</p>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card events">
                <mat-card-content>
                  <p class="stat-value">{{ learningSummary.corrections.length }}</p>
                  <p class="stat-label">Corrections</p>
                </mat-card-content>
              </mat-card>
            </div>

            <div *ngIf="learningSummary.topRejected.length" style="margin-top:12px;">
              <p style="font-size:13px;font-weight:600;margin:0 0 8px;">Top Rejected Targets</p>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <div *ngFor="let item of learningSummary.topRejected" style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--ri-surface-container);border-radius:6px;font-size:13px;">
                  <span>{{ item.targetId }}</span>
                  <span style="color:#b3261e;font-weight:600;">{{ item.count }} rejection{{ item.count > 1 ? 's' : '' }}</span>
                </div>
              </div>
            </div>
          </div>

          <mat-card class="state-card" *ngIf="!learningLoading && !learningSummary">
            <mat-card-content><p style="text-align:center;color:var(--ri-on-surface-variant);">No feedback submitted yet. Use the form above to log your first signal.</p></mat-card-content>
          </mat-card>
        </mat-card-content>
      </mat-card>
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

    .state-card,
    .section-card {
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
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
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
    }

    .stat-label {
      margin: 6px 0 0 0;
      color: var(--ri-on-surface-variant);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }

    .stat-card.pressure .stat-value { color: #1f4e79; }
    .stat-card.critical .stat-value { color: #ba1a1a; }
    .stat-card.trend .stat-value { color: #f57c00; }
    .stat-card.events .stat-value { color: #6a1b9a; }

    .hotspot-list {
      display: grid;
      gap: 10px;
    }

    .hotspot-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 8px;
      background: var(--ri-surface-container);
      flex-wrap: wrap;
    }

    .hotspot-main {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .project-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--ri-on-surface);
    }

    .project-meta {
      margin: 0;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .hotspot-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .chip {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      background: #eceff1;
      color: #37474f;
    }

    .chip.score {
      background: #e8f0fe;
      color: #1f4e79;
    }

    .band-low { background: #e8f5e9; color: #2e7d32; }
    .band-medium { background: #fff8e1; color: #f9a825; }
    .band-high { background: #ffe8cc; color: #f57c00; }
    .band-critical { background: #ffebee; color: #ba1a1a; }

    .severity-low { background: #e8f5e9; color: #2e7d32; }
    .severity-medium { background: #fff8e1; color: #f9a825; }
    .severity-high { background: #ffe8cc; color: #f57c00; }
    .severity-critical { background: #ffebee; color: #ba1a1a; }
    .severity-none { background: #eceff1; color: #455a64; }

    .watchlist-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }

    .watchlist {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    .watchlist li {
      display: flex;
      flex-direction: column;
      gap: 3px;
      border-left: 3px solid var(--ri-primary);
      padding-left: 10px;
    }

    .watch-meta {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }
  `],
})
export class EngineeringComponent implements OnInit {
  loading = false;
  errorMessage = '';

  hotspots: EngineeringHotspot[] = [];
  reliabilityWatchlist: EngineeringHotspot[] = [];
  qualityDrift: EngineeringHotspot[] = [];

  deliveryPressure = 0;
  highRiskCount = 0;
  regressionCount = 0;
  criticalEventCount = 0;
  anomalySummary: PortfolioAnomalySummary | null = null;
  modelHealthIndex = 0;
  escalatedSignalRatio = 0;

  // Feedback panel state
  feedbackTargetType: 'recommendation' | 'insight' | 'anomaly' | 'report' = 'recommendation';
  feedbackTargetId = '';
  feedbackSignal: FeedbackSignal = 'accepted';
  feedbackComment = '';
  feedbackSubmitting = false;
  feedbackSuccessMsg = '';
  feedbackErrorMsg = '';
  learningSummary: LearningSummary | null = null;
  learningLoading = false;

  constructor(
    private projectsService: ProjectsService,
    private riskService: RiskService,
    private feedbackService: FeedbackService,
  ) {}

  ngOnInit(): void {
    this.loadInsights();
    this.loadLearning();
  }

  loadInsights(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      projects: this.projectsService.getProjects({ status: 'active' }).pipe(
        catchError(() => of({ projects: [], total: 0 }))
      ),
      riskScores: this.riskService.refreshRiskScores().pipe(
        catchError(() => of([] as RiskScore[]))
      ),
      anomalies: this.riskService.getPortfolioAnomalies().pipe(
        catchError(() => of([] as ProjectAnomaly[]))
      ),
      anomalySummary: this.riskService.getPortfolioAnomalySummary().pipe(
        catchError(() => of(null))
      ),
    })
      .pipe(finalize(() => {
        this.loading = false;
      }))
      .subscribe(({ projects, riskScores, anomalies, anomalySummary }) => {
        this.buildInsights(projects.projects || [], riskScores, anomalies, anomalySummary);
      });
  }

  private buildInsights(projects: ProjectItem[], riskScores: RiskScore[], anomalies: ProjectAnomaly[], anomalySummary: PortfolioAnomalySummary | null): void {
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const anomalyMap = new Map(anomalies.map((anomaly) => [anomaly.projectId, anomaly]));

    this.hotspots = riskScores
      .map((riskScore) => {
        const project = projectMap.get(riskScore.projectId);
        if (!project) {
          return null;
        }

        const anomaly = anomalyMap.get(riskScore.projectId);
        return {
          projectId: riskScore.projectId,
          projectName: project.name,
          team: project.team,
          riskScore: riskScore.score,
          riskBand: riskScore.band,
          anomalySeverity: anomaly?.severity || 'NONE',
          anomalyTrend: anomaly?.trend || 'none',
          criticalEvents: anomaly?.metrics?.severityCounts?.critical || 0,
          dominantSignal: this.getDominantSignal(riskScore),
        } as EngineeringHotspot;
      })
      .filter((item): item is EngineeringHotspot => !!item)
      .sort((a, b) => this.hotspotScore(b) - this.hotspotScore(a));

    this.reliabilityWatchlist = this.hotspots
      .filter((hotspot) => hotspot.dominantSignal === 'cicd' || hotspot.anomalyTrend === 'regression')
      .slice(0, 5);

    this.qualityDrift = this.hotspots
      .filter((hotspot) => hotspot.dominantSignal === 'quality' || hotspot.riskBand === 'CRITICAL')
      .slice(0, 5);

    this.highRiskCount = this.hotspots.filter((item) => item.riskBand === 'HIGH' || item.riskBand === 'CRITICAL').length;
    this.regressionCount = this.hotspots.filter((item) => item.anomalyTrend === 'regression').length;
    this.criticalEventCount = this.hotspots.reduce((sum, item) => sum + item.criticalEvents, 0);
    this.deliveryPressure = this.hotspots.length
      ? Math.round(this.hotspots.reduce((sum, item) => sum + item.riskScore, 0) / this.hotspots.length)
      : 0;

    this.anomalySummary = anomalySummary;
    this.computeModelMonitoringStats();

  }

  private computeModelMonitoringStats(): void {
    if (!this.anomalySummary) {
      this.modelHealthIndex = 100;
      this.escalatedSignalRatio = 0;
      return;
    }

    const weightedIncidentScore =
      (this.anomalySummary.criticalCount * 6) +
      (this.anomalySummary.highCount * 4) +
      (this.anomalySummary.mediumCount * 2) +
      this.anomalySummary.lowCount;

    const normalizedIncidentScore = Math.min(100, weightedIncidentScore);
    this.modelHealthIndex = Math.max(0, 100 - normalizedIncidentScore);

    const denominator = this.anomalySummary.totalProjects || 1;
    this.escalatedSignalRatio = Math.round((this.anomalySummary.escalatedCount / denominator) * 100);

  }

  private hotspotScore(hotspot: EngineeringHotspot): number {
    const bandWeight: Record<RiskScore['band'], number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const severityWeight: Record<EngineeringHotspot['anomalySeverity'], number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    return (hotspot.riskScore * 2) + (bandWeight[hotspot.riskBand] * 10) + (severityWeight[hotspot.anomalySeverity] * 8) + hotspot.criticalEvents;
  }

  private getDominantSignal(riskScore: RiskScore): EngineeringHotspot['dominantSignal'] {
    const entries = Object.entries(riskScore.signals) as Array<[EngineeringHotspot['dominantSignal'], number]>;
    entries.sort((a, b) => a[1] - b[1]);
    return entries[0][0];
  }

  // ── Feedback Loop ──────────────────────────────────────────────────────────

  loadLearning(): void {
    this.learningLoading = true;
    this.feedbackService.getLearning().subscribe({
      next: (res) => {
        this.learningSummary = res.learning;
        this.learningLoading = false;
      },
      error: (err) => {
        console.error('Learning data load error:', err);
        this.learningLoading = false;
      },
    });
  }

  submitFeedback(): void {
    if (!this.feedbackTargetId.trim()) return;

    this.feedbackSubmitting = true;
    this.feedbackSuccessMsg = '';
    this.feedbackErrorMsg = '';

    const payload: SubmitFeedbackPayload = {
      projectId: this.hotspots[0]?.projectId || 'portfolio',
      targetType: this.feedbackTargetType,
      targetId: this.feedbackTargetId.trim(),
      signal: this.feedbackSignal,
      comment: this.feedbackComment,
    };

    this.feedbackService.submit(payload).subscribe({
      next: () => {
        this.feedbackSubmitting = false;
        this.feedbackSuccessMsg = `Feedback recorded: ${this.feedbackSignal} for ${this.feedbackTargetId}`;
        this.feedbackTargetId = '';
        this.feedbackComment = '';
        this.loadLearning();
      },
      error: (err) => {
        console.error('Feedback submit error:', err);
        this.feedbackSubmitting = false;
        this.feedbackErrorMsg = 'Failed to submit feedback. Please try again.';
      },
    });
  }
}
