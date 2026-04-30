import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { AuthService } from '../../shared/services/auth.service';
import { ProjectsService } from '../../shared/services/projects.service';
import { ProjectAnomaly, ProjectRiskTrend, RiskScore, RiskService } from '../../shared/services/risk.service';
import { AlertService, ProjectAlert } from '../../shared/services/alert.service';
import { ExecutiveReport, ReportingService } from '../../shared/services/reporting.service';
import { ForecastService, PortfolioForecast } from '../../shared/services/forecast.service';
import { BudgetHealth, DashboardMetricsService, DependencyMap, OwnerWorkload, RecommendationAdoption, ReleaseReadiness, TeamCapacityMetrics, QualitySnapshot, TimelineHealth } from '../../shared/services/dashboard-metrics.service';
import { getRecommendedActionsForAnomaly } from '../../shared/utils/risk-guidance';
import { RiskHeatmapComponent } from '../../shared/components/risk-heatmap.component';
import { RiskScoreCardComponent, TrendAgeStatus, TrendDirection } from '../../shared/components/risk-score-card.component';

interface DashboardMetrics {
  openHighRisks: number;
  activeProjects: number;
  avgProbability: number;
  lowRiskProjects: number;
}

interface ExecutiveSnapshotFallback {
  overallRag: 'GREEN' | 'AMBER' | 'RED';
  totalProjects: number;
  atRiskProjects: number;
  averageRiskScore: number;
  openRecommendations: number;
  generatedAt: string;
  highlights: Array<{
    projectName: string;
    riskScore: number;
    rag: 'GREEN' | 'AMBER' | 'RED';
  }>;
}

type AttentionItemCategory = 'high_risk' | 'dependency' | 'budget' | 'recommendation' | 'owner';

interface AttentionItem {
  category: AttentionItemCategory;
  projectName: string;
  summary: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionLabel: string;
  projectId?: string;
  priorityScore: number;
}

interface PortfolioOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RiskHeatmapComponent,
    RiskScoreCardComponent,
  ],
  template: `
    <div class="dashboard-container">
      <h1 class="text-display-lg">Delivery Dashboard</h1>
      <p class="subtitle">Multi-stream project health monitoring and risk distribution tracking.</p>

      <div class="toolbar-row">
        <div class="toolbar-controls">
          <label class="toolbar-label" for="portfolio-chip-input">Portfolio</label>
          <mat-form-field class="portfolio-chip-field" appearance="outline">
            <input
              id="portfolio-chip-input"
              matInput
              [formControl]="portfolioInputControl"
              [matAutocomplete]="portfolioAuto"
              placeholder="Search and select portfolio"
            />
            <mat-autocomplete #portfolioAuto="matAutocomplete" (optionSelected)="onPortfolioOptionSelected($event)">
              <mat-option value="" *ngIf="selectedPortfolioId">
                All Portfolios
              </mat-option>
              <mat-option *ngFor="let portfolio of getFilteredPortfolioOptions()" [value]="portfolio">
                {{ portfolio.name }}
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
          <div class="selected-portfolio-chip-row" *ngIf="selectedPortfolio">
            <mat-chip-set aria-label="Selected portfolio">
              <mat-chip [removable]="true" (removed)="clearPortfolioSelection()" class="selected-portfolio-chip">
                {{ selectedPortfolio.name }}
                <button matChipRemove type="button" aria-label="Clear portfolio selection">x</button>
              </mat-chip>
            </mat-chip-set>
          </div>
        </div>
        <div class="toolbar-meta">
          <p class="last-updated" *ngIf="lastUpdated && !loading">Last updated: {{ lastUpdated }}</p>
          <button mat-stroked-button type="button" (click)="loadDashboard()" [disabled]="loading">Refresh</button>
        </div>
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

      <mat-card class="section-card executive-card" *ngIf="!loading && !errorMessage">
        <mat-card-header>
          <mat-card-title>Executive Snapshot</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!latestExecutiveReport && !latestPortfolioForecast && !fallbackExecutiveSnapshot">
            Executive reporting inputs are not available yet. Generate a report or forecast from the Action Center.
          </p>

          <div class="executive-grid" *ngIf="latestExecutiveReport || latestPortfolioForecast || fallbackExecutiveSnapshot">
            <div class="executive-block" *ngIf="!latestExecutiveReport && fallbackExecutiveSnapshot as fallback">
              <div class="executive-block-header">
                <h3>Live Portfolio Snapshot</h3>
                <span class="executive-pill" [class]="'rag-' + fallback.overallRag.toLowerCase()">
                  {{ fallback.overallRag }}
                </span>
              </div>
              <p class="executive-meta">
                Derived from current live dashboard metrics · {{ fallback.generatedAt | date:'medium' }}
              </p>
              <div class="executive-stats-row">
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ fallback.totalProjects }}</span>
                  <span class="executive-stat-label">Projects</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ fallback.atRiskProjects }}</span>
                  <span class="executive-stat-label">At Risk</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ fallback.averageRiskScore }}</span>
                  <span class="executive-stat-label">Avg Risk</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ fallback.openRecommendations }}</span>
                  <span class="executive-stat-label">Open Recs</span>
                </div>
              </div>
              <div class="executive-list" *ngIf="fallback.highlights.length">
                <div class="executive-list-row" *ngFor="let risk of fallback.highlights.slice(0, 3)">
                  <span class="program-name">{{ risk.projectName }}</span>
                  <span class="risk-chip" [class]="'risk-' + risk.rag.toLowerCase()">{{ risk.rag }} · {{ risk.riskScore }}</span>
                </div>
              </div>
            </div>

            <div class="executive-block" *ngIf="latestExecutiveReport">
              <div class="executive-block-header">
                <h3>Latest Executive Report</h3>
                <span class="executive-pill" [class]="'rag-' + latestExecutiveReport.sections.executiveSummary.overallRag.toLowerCase()">
                  {{ latestExecutiveReport.sections.executiveSummary.overallRag }}
                </span>
              </div>
              <p class="executive-meta">
                {{ latestExecutiveReport.reportType | titlecase }} · {{ latestExecutiveReport.generatedAt | date:'medium' }}
              </p>
              <div class="executive-stats-row">
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestExecutiveReport.sections.executiveSummary.portfolioHealth.totalProjects }}</span>
                  <span class="executive-stat-label">Projects</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestExecutiveReport.sections.executiveSummary.portfolioHealth.atRisk }}</span>
                  <span class="executive-stat-label">At Risk</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestExecutiveReport.sections.executiveSummary.averageRiskScore }}</span>
                  <span class="executive-stat-label">Avg Risk</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestExecutiveReport.sections.executiveSummary.openRecommendations }}</span>
                  <span class="executive-stat-label">Open Recs</span>
                </div>
              </div>
              <div class="executive-list" *ngIf="latestExecutiveReport.sections.topRisks.length">
                <div class="executive-list-row" *ngFor="let risk of latestExecutiveReport.sections.topRisks.slice(0, 3)">
                  <span class="program-name">{{ risk.projectName }}</span>
                  <span class="risk-chip" [class]="'risk-' + risk.rag.toLowerCase()">{{ risk.rag }} · {{ risk.riskScore }}</span>
                </div>
              </div>
            </div>

            <div class="executive-block" *ngIf="latestPortfolioForecast">
              <div class="executive-block-header">
                <h3>Latest Portfolio Forecast</h3>
                <span class="executive-meta">{{ latestPortfolioForecast.generatedAt | date:'medium' }}</span>
              </div>
              <div class="executive-stats-row">
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestPortfolioForecast.totalProjects }}</span>
                  <span class="executive-stat-label">Projects</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestPortfolioForecast.summary.worseningCount }}</span>
                  <span class="executive-stat-label">Worsening</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestPortfolioForecast.summary.improvingCount }}</span>
                  <span class="executive-stat-label">Improving</span>
                </div>
                <div class="executive-stat">
                  <span class="executive-stat-value">{{ latestPortfolioForecast.summary.atRiskCount }}</span>
                  <span class="executive-stat-label">At Risk</span>
                </div>
              </div>
              <div class="executive-list" *ngIf="latestPortfolioForecast.completionForecasts.length">
                <div class="executive-list-row" *ngFor="let forecast of latestPortfolioForecast.completionForecasts.slice(0, 3)">
                  <span class="program-name">{{ forecast.projectName }}</span>
                  <span class="executive-forecast-copy">
                    {{ forecast.estimatedCompletionDate || 'No completion date' }} · {{ forecast.confidence }} confidence
                  </span>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

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
              [trendLoading]="projectTrendLoading[risk.projectId] === true"
              [trendDirection]="projectTrendDirections[risk.projectId] || null"
              [trendLastUpdated]="projectTrendUpdatedAt[risk.projectId] || null"
              [trendAgeStatus]="projectTrendAgeStatus[risk.projectId] || null"
              [retryDisabled]="isRetryDisabled(risk.projectId)"
              [retryHint]="getRetryHint(risk.projectId)"
              (retryTrend)="retryProjectTrend($event)"
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

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && attentionItems.length">
        <mat-card-header>
          <mat-card-title>What Needs Attention Now</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="attention-list">
            <div class="attention-item" *ngFor="let item of attentionItems.slice(0, 6)">
              <div class="attention-primary">
                <div class="attention-headline-row">
                  <span class="attention-project">{{ item.projectName }}</span>
                  <span class="risk-chip" [class]="'risk-' + item.severity.toLowerCase()">{{ item.severity }}</span>
                </div>
                <p class="attention-summary">{{ item.summary }}</p>
              </div>
              <button mat-stroked-button type="button" (click)="takeAttentionAction(item)">
                {{ item.actionLabel }}
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- PHASE 1: TEAM CAPACITY VIEW -->
      <mat-card class="section-card" *ngIf="!loading && !errorMessage && teamCapacity">
        <mat-card-header>
          <mat-card-title>Team Capacity View</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p *ngIf="!teamCapacity.teams.length">No team capacity data available.</p>
          <div class="teams-grid" *ngIf="teamCapacity.teams.length">
            <div class="team-card" *ngFor="let team of teamCapacity.teams">
              <div class="team-header">
                <h4>{{ team.team | titlecase }}</h4>
                <span class="team-badge" [class]="'risk-' + team.riskLevel.toLowerCase()">{{ team.riskLevel }}</span>
              </div>
              <div class="team-stats">
                <div class="stat">
                  <span class="stat-value">{{ team.projectCount }}</span>
                  <span class="stat-label">Projects</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{{ team.utilizationPercentage }}%</span>
                  <span class="stat-label">Utilization</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{{ team.avgRiskScore }}</span>
                  <span class="stat-label">Avg Risk</span>
                </div>
              </div>
              <div class="team-alert" *ngIf="team.utilizationPercentage > 75">
                ⚠️ Team is overallocated
              </div>
              <div class="top-risks" *ngIf="team.topRiskProjects.length">
                <p class="mini-label">Top Risk Projects:</p>
                <div class="risk-item" *ngFor="let proj of team.topRiskProjects">
                  <span>{{ proj.name }}</span>
                  <span class="risk-chip" [class]="'risk-' + proj.band.toLowerCase()">{{ proj.band }} · {{ proj.riskScore }}</span>
                </div>
              </div>
            </div>
          </div>
          <p class="summary-text" *ngIf="teamCapacity.overloadedTeams > 0">
            ⚠️ {{ teamCapacity.overloadedTeams }} team(s) are overallocated (>75% utilization)
          </p>
        </mat-card-content>
      </mat-card>

      <!-- PHASE 1: QUALITY SNAPSHOT -->
      <mat-card class="section-card" *ngIf="!loading && !errorMessage && qualitySnapshot">
        <mat-card-header>
          <mat-card-title>Quality Snapshot</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="quality-overview">
            <div class="quality-gauge">
              <div class="gauge-circle" [class]="'quality-' + qualitySnapshot.qualityLevel.toLowerCase()">
                <span class="gauge-value">{{ qualitySnapshot.portfolioQualityScore }}%</span>
                <span class="gauge-label">Portfolio Quality</span>
              </div>
              <div class="gauge-stats">
                <div class="gauge-stat">
                  <span class="stat-value">{{ qualitySnapshot.projectsTracked }}</span>
                  <span class="stat-label">Projects Tracked</span>
                </div>
                <div class="gauge-stat">
                  <span class="stat-value">{{ qualitySnapshot.highQualityProjects }}</span>
                  <span class="stat-label">High Quality</span>
                </div>
                <div class="gauge-stat">
                  <span class="stat-value">{{ qualitySnapshot.lowQualityProjects }}</span>
                  <span class="stat-label">At Risk</span>
                </div>
                <div class="gauge-stat">
                  <span class="stat-value">{{ qualitySnapshot.qualityTrend }}</span>
                  <span class="stat-label">Trend</span>
                </div>
              </div>
            </div>
          </div>
          <div class="quality-table">
            <p class="table-label">Lowest Quality Projects</p>
            <div class="table-row" *ngFor="let proj of qualitySnapshot.lowestQualityProjects.slice(0, 3)">
              <span class="project-name">{{ proj.projectName }}</span>
              <div class="quality-row-stats">
                <span class="quality-score" [class]="'quality-' + proj.qualityLevel.toLowerCase()">{{ proj.qualityScore }}%</span>
                <span class="team-label">{{ proj.team }}</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- PHASE 1: TIMELINE HEALTH -->
      <mat-card class="section-card" *ngIf="!loading && !errorMessage && timelineHealth">
        <mat-card-header>
          <mat-card-title>Timeline Health & Delivery Forecast</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="timeline-overview">
            <div class="timeline-metric">
              <div class="metric-circle" [class]="timelineHealth.timelineHealthPercentage >= 70 ? 'healthy' : 'at-risk'">
                {{ timelineHealth.timelineHealthPercentage }}%
              </div>
              <span class="metric-label">Timeline Health</span>
            </div>
            <div class="timeline-stats">
              <div class="timeline-stat">
                <span class="stat-value">{{ timelineHealth.onTrackProjects }}</span>
                <span class="stat-label">On Track</span>
              </div>
              <div class="timeline-stat warn" *ngIf="timelineHealth.atRiskProjects > 0">
                <span class="stat-value">{{ timelineHealth.atRiskProjects }}</span>
                <span class="stat-label">At Risk</span>
              </div>
              <div class="timeline-stat alert" *ngIf="timelineHealth.delayedProjects > 0">
                <span class="stat-value">{{ timelineHealth.delayedProjects }}</span>
                <span class="stat-label">Delayed</span>
              </div>
              <div class="timeline-stat">
                <span class="stat-value">{{ timelineHealth.projectsTracked }}</span>
                <span class="stat-label">Total Tracked</span>
              </div>
            </div>
          </div>
          <div class="critical-path" *ngIf="timelineHealth.criticalPath.length">
            <p class="path-label">🚨 Critical Path: Projects Needing Attention</p>
            <div class="path-item" *ngFor="let proj of timelineHealth.criticalPath.slice(0, 5)">
              <div class="path-info">
                <span class="path-name">{{ proj.projectName }}</span>
                <span class="path-status" [class]="'status-' + proj.status">{{ (proj.status === 'on_track' ? 'On Track' : proj.status === 'at_risk' ? 'At Risk' : 'Delayed') }}</span>
              </div>
              <div class="path-metrics">
                <span class="path-metric">{{ proj.percentComplete }}% complete</span>
                <span class="path-metric warn">{{ proj.daysRemaining }} days remaining</span>
                <span class="path-metric" [class]="'velocity-' + proj.velocityIndicator">{{ proj.velocityIndicator }} velocity</span>
              </div>
            </div>
          </div>
          <div class="early-warnings" *ngIf="timelineHealth.earlyWarnings.length">
            <p class="warning-label">⚠️ Early Warnings</p>
            <div class="warning-item" *ngFor="let warn of timelineHealth.earlyWarnings.slice(0, 3)">
              <span class="warning-project">{{ warn.projectName }}</span>
              <span class="warning-reason">{{ warn.reason }}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- PHASE 2: DEPENDENCY MAP -->
      <mat-card class="section-card" *ngIf="!loading && !errorMessage && dependencyMap">
        <mat-card-header>
          <mat-card-title>Dependency Map & Blockers</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="dependency-overview">
            <div class="dependency-stat">
              <span class="stat-value">{{ dependencyMap.projectsTracked }}</span>
              <span class="stat-label">Projects Tracked</span>
            </div>
            <div class="dependency-stat">
              <span class="stat-value">{{ dependencyMap.dependencyLinks }}</span>
              <span class="stat-label">Dependency Links</span>
            </div>
            <div class="dependency-stat warn" *ngIf="dependencyMap.blockedProjects > 0">
              <span class="stat-value">{{ dependencyMap.blockedProjects }}</span>
              <span class="stat-label">Blocked Projects</span>
            </div>
            <div class="dependency-stat alert" *ngIf="dependencyMap.criticalBlockers > 0">
              <span class="stat-value">{{ dependencyMap.criticalBlockers }}</span>
              <span class="stat-label">Critical Blockers</span>
            </div>
          </div>

          <div class="dependency-list" *ngIf="dependencyMap.atRiskDependencies.length; else noDependencyBlockers">
            <p class="dependency-label">Top At-Risk Dependencies</p>
            <div class="dependency-item" *ngFor="let dep of dependencyMap.atRiskDependencies.slice(0, 6)">
              <div class="dependency-path">
                <span class="source">{{ dep.sourceProjectName }}</span>
                <span class="arrow">→</span>
                <span class="target">{{ dep.targetProjectName }}</span>
              </div>
              <div class="dependency-meta">
                <span class="risk-chip" [class]="'risk-' + dep.blockerRiskBand.toLowerCase()">{{ dep.blockerRiskBand }} · {{ dep.blockerRiskScore }}</span>
                <span class="team-link">{{ dep.sourceTeam }} -> {{ dep.targetTeam }}</span>
              </div>
            </div>
          </div>

          <ng-template #noDependencyBlockers>
            <p class="summary-text">No blocked dependencies detected in the current portfolio snapshot.</p>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && releaseReadiness">
        <mat-card-header>
          <mat-card-title>Release Readiness</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="release-overview">
            <div class="release-gauge" [class]="'quality-' + releaseReadiness.readinessLevel.toLowerCase()">
              <span class="gauge-value">{{ releaseReadiness.portfolioReadinessScore }}%</span>
              <span class="gauge-label">Portfolio Readiness</span>
            </div>
            <div class="release-stats">
              <div class="release-stat">
                <span class="stat-value">{{ releaseReadiness.releaseCandidates }}</span>
                <span class="stat-label">Release Candidates</span>
              </div>
              <div class="release-stat warn" *ngIf="releaseReadiness.blockedReleases > 0">
                <span class="stat-value">{{ releaseReadiness.blockedReleases }}</span>
                <span class="stat-label">Blocked Releases</span>
              </div>
              <div class="release-stat">
                <span class="stat-value">{{ releaseReadiness.projectsTracked }}</span>
                <span class="stat-label">Tracked Projects</span>
              </div>
            </div>
          </div>

          <div class="checklist-grid">
            <div class="check-item">
              <span>QA Gate</span>
              <span>{{ releaseReadiness.checklistCompletion.qaGate }}%</span>
            </div>
            <div class="check-item">
              <span>CI Stability</span>
              <span>{{ releaseReadiness.checklistCompletion.ciStability }}%</span>
            </div>
            <div class="check-item">
              <span>Delivery Predictability</span>
              <span>{{ releaseReadiness.checklistCompletion.deliveryPredictability }}%</span>
            </div>
          </div>

          <div class="release-table" *ngIf="releaseReadiness.projects.length">
            <p class="table-label">Projects Requiring Readiness Attention</p>
            <div class="table-row" *ngFor="let proj of releaseReadiness.projects.slice(0, 5)">
              <span class="project-name">{{ proj.projectName }}</span>
              <div class="quality-row-stats">
                <span class="quality-score" [class]="proj.readinessScore >= 75 ? 'quality-high' : proj.readinessScore >= 60 ? 'quality-medium' : 'quality-low'">{{ proj.readinessScore }}%</span>
                <span class="team-label">{{ proj.blockers.length ? proj.blockers[0] : 'Ready' }}</span>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && budgetHealth">
        <mat-card-header>
          <mat-card-title>Budget Health</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="dependency-overview">
            <div class="dependency-stat">
              <span class="stat-value">{{ budgetHealth.projectsTracked }}</span>
              <span class="stat-label">Projects Tracked</span>
            </div>
            <div class="dependency-stat">
              <span class="stat-value">{{ budgetHealth.totalVariancePercentage }}%</span>
              <span class="stat-label">Portfolio Variance</span>
            </div>
            <div class="dependency-stat warn" *ngIf="budgetHealth.watchProjects > 0">
              <span class="stat-value">{{ budgetHealth.watchProjects }}</span>
              <span class="stat-label">Watch Projects</span>
            </div>
            <div class="dependency-stat alert" *ngIf="budgetHealth.overBudgetProjects > 0">
              <span class="stat-value">{{ budgetHealth.overBudgetProjects }}</span>
              <span class="stat-label">Over Budget</span>
            </div>
          </div>

          <div class="dependency-list" *ngIf="budgetHealth.topOverruns.length; else noBudgetOverrun">
            <p class="dependency-label">Top Budget Overruns</p>
            <div class="dependency-item" *ngFor="let item of budgetHealth.topOverruns.slice(0, 5)">
              <div class="dependency-path">
                <span class="source">{{ item.projectName }}</span>
                <span class="arrow">•</span>
                <span class="target">{{ item.team }}</span>
              </div>
              <div class="dependency-meta">
                <span class="risk-chip" [class]="item.budgetStatus === 'over_budget' ? 'risk-critical' : item.budgetStatus === 'watch' ? 'risk-high' : 'risk-low'">
                  {{ item.variancePercentage }}% variance
                </span>
                <span class="team-link">Planned {{ item.plannedBudget | number:'1.0-0' }} / Projected {{ item.projectedSpend | number:'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <ng-template #noBudgetOverrun>
            <p class="summary-text">No budget overruns detected in the current portfolio snapshot.</p>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && recommendationAdoption">
        <mat-card-header>
          <mat-card-title>Recommendation Adoption</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="dependency-overview">
            <div class="dependency-stat">
              <span class="stat-value">{{ recommendationAdoption.activeRecommendations }}</span>
              <span class="stat-label">Active Recommendations</span>
            </div>
            <div class="dependency-stat">
              <span class="stat-value">{{ recommendationAdoption.estimatedAdoptionRate }}%</span>
              <span class="stat-label">Estimated Adoption Rate</span>
            </div>
            <div class="dependency-stat warn">
              <span class="stat-value">{{ recommendationAdoption.highPriorityRecommendations }}</span>
              <span class="stat-label">P1 Recommendations</span>
            </div>
            <div class="dependency-stat" *ngIf="recommendationAdoption.topOwners.length">
              <span class="stat-value">{{ recommendationAdoption.topOwners.length }}</span>
              <span class="stat-label">Owner Hotspots</span>
            </div>
          </div>

          <div class="dependency-list" *ngIf="recommendationAdoption.topRecommendations.length; else noAdoptionGaps">
            <p class="dependency-label">Top Recommendations Requiring Follow-up</p>
            <div class="dependency-item" *ngFor="let item of recommendationAdoption.topRecommendations.slice(0, 5)">
              <div class="dependency-path">
                <span class="source">{{ item.projectName }}</span>
                <span class="arrow">•</span>
                <span class="target">{{ item.title }}</span>
              </div>
              <div class="dependency-meta">
                <span class="risk-chip" [class]="item.priority === 'P1' ? 'risk-critical' : item.priority === 'P2' ? 'risk-high' : 'risk-low'">
                  {{ item.priority }} · {{ item.confidence }}%
                </span>
              </div>
            </div>
          </div>

          <ng-template #noAdoptionGaps>
            <p class="summary-text">No high-priority recommendations require immediate follow-up.</p>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card" *ngIf="!loading && !errorMessage && ownerWorkload">
        <mat-card-header>
          <mat-card-title>Owner Workload</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="dependency-overview">
            <div class="dependency-stat">
              <span class="stat-value">{{ ownerWorkload.ownersTracked }}</span>
              <span class="stat-label">Owners Tracked</span>
            </div>
            <div class="dependency-stat" [class.warn]="ownerWorkload.overloadedOwners > 0">
              <span class="stat-value">{{ ownerWorkload.overloadedOwners }}</span>
              <span class="stat-label">Overloaded Owners</span>
            </div>
            <div class="dependency-stat">
              <span class="stat-value">{{ ownerWorkload.highestOwnerLoad }}</span>
              <span class="stat-label">Peak Recommendation Load</span>
            </div>
            <div class="dependency-stat">
              <span class="stat-value">{{ ownerWorkload.averageRecommendationsPerOwner }}</span>
              <span class="stat-label">Avg Recs per Owner</span>
            </div>
          </div>

          <div class="dependency-list" *ngIf="ownerWorkload.topOwners.length; else noOwnerHotspots">
            <p class="dependency-label">Top Owner Hotspots</p>
            <div class="dependency-item" *ngFor="let owner of ownerWorkload.topOwners.slice(0, 5)">
              <div class="dependency-path">
                <span class="source">{{ owner.ownerRole }}</span>
                <span class="arrow">•</span>
                <span class="target">{{ owner.projectCount }} project{{ owner.projectCount === 1 ? '' : 's' }}</span>
              </div>
              <div class="dependency-meta">
                <span class="risk-chip" [class]="owner.workloadRiskLevel === 'HIGH' ? 'risk-critical' : owner.workloadRiskLevel === 'MEDIUM' ? 'risk-high' : 'risk-low'">
                  {{ owner.recommendationCount }} recs · {{ owner.highPriorityCount }} P1
                </span>
              </div>
            </div>
          </div>

          <ng-template #noOwnerHotspots>
            <p class="summary-text">Recommendation ownership is evenly distributed across the portfolio.</p>
          </ng-template>
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
      margin: 0 0 24px 0;
      font-size: 14px;
      line-height: 1.5;
    }

    .toolbar-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      padding: 16px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      box-shadow: 0 4px 12px rgba(15, 25, 60, 0.04);
      overflow: visible;
    }

    .toolbar-controls {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      flex: 1 1 380px;
      min-width: 280px;
      max-width: 520px;
      overflow: visible;
    }

    .toolbar-label {
      font-size: 11px;
      color: color-mix(in srgb, var(--ri-on-surface-variant) 86%, black);
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .portfolio-chip-field {
      width: min(300px, 100%);
      margin: 0;
      transition: transform 0.18s ease;

      ::ng-deep .mat-mdc-form-field-flex {
        background: #ffffff;
        border-radius: 999px;
      }

      ::ng-deep .mat-mdc-text-field-wrapper {
        border-radius: 999px;
      }

      ::ng-deep .mdc-text-field {
        border-radius: 999px;
        transition: box-shadow 0.18s ease, border-color 0.18s ease;
      }

      ::ng-deep .mat-mdc-form-field-infix {
        min-height: 38px;
        padding: 4px 8px;
      }

      ::ng-deep .mat-mdc-form-field-focus-overlay {
        background: transparent;
        border-radius: 999px;
      }

      ::ng-deep .mdc-notched-outline__leading {
        border-color: var(--ri-outline-variant);
        border-radius: 999px 0 0 999px;
        min-width: 20px;
      }

      ::ng-deep .mdc-notched-outline__notch {
        border-color: var(--ri-outline-variant);
      }

      ::ng-deep .mdc-notched-outline__trailing {
        border-color: var(--ri-outline-variant);
        border-radius: 0 999px 999px 0;
      }

      ::ng-deep .mdc-text-field:hover .mdc-notched-outline__leading,
      ::ng-deep .mdc-text-field:hover .mdc-notched-outline__notch,
      ::ng-deep .mdc-text-field:hover .mdc-notched-outline__trailing {
        border-color: color-mix(in srgb, var(--ri-primary) 42%, var(--ri-outline-variant));
      }

      ::ng-deep .mdc-text-field--focused .mdc-notched-outline__leading,
      ::ng-deep .mdc-text-field--focused .mdc-notched-outline__notch,
      ::ng-deep .mdc-text-field--focused .mdc-notched-outline__trailing {
        border-color: var(--ri-outline-variant);
        border-width: 1px;
      }

      ::ng-deep .mdc-text-field--focused {
        box-shadow: none;
      }

      @media (max-width: 768px) {
        width: 100%;
      }
    }

    .portfolio-chip-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .portfolio-chip-field input {
      min-width: 120px;
      font-size: 12px;
      line-height: 16px;
    }

    .portfolio-chip-field input::placeholder {
      color: color-mix(in srgb, var(--ri-on-surface-variant) 82%, white);
      opacity: 1;
    }

    :host ::ng-deep .mat-mdc-autocomplete-panel {
      border: 1px solid var(--ri-outline-variant);
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(6, 17, 55, 0.12);
      padding: 6px;
      z-index: 1100 !important;
      position: relative;
      background: #ffffff;
    }

    ::ng-deep .cdk-overlay-container {
      z-index: 1100;
    }

    :host ::ng-deep .mat-mdc-autocomplete-panel .mat-mdc-option {
      border-radius: 8px;
      min-height: 40px;
    }

    :host ::ng-deep .mat-mdc-autocomplete-panel .mat-mdc-option.mdc-list-item--selected,
    :host ::ng-deep .mat-mdc-autocomplete-panel .mat-mdc-option:hover {
      background: color-mix(in srgb, var(--ri-primary) 12%, white);
    }

    .selected-portfolio-chip-row {
      width: min(300px, 100%);
      margin-top: 2px;
    }

    .selected-portfolio-chip-row ::ng-deep .mdc-evolution-chip-set__chips {
      gap: 6px;
    }

    .selected-portfolio-chip {
      background: color-mix(in srgb, var(--ri-primary) 14%, white);
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--ri-primary) 30%, white);
      color: var(--ri-primary);
      font-weight: 600;
      padding-inline: 4px;
    }

    .selected-portfolio-chip-row ::ng-deep .selected-portfolio-chip {
      height: 22px;
      min-height: 22px;
    }

    .selected-portfolio-chip-row ::ng-deep .selected-portfolio-chip .mdc-evolution-chip__text-label {
      font-size: 10px;
      line-height: 12px;
    }

    .selected-portfolio-chip-row ::ng-deep .mat-mdc-chip-remove {
      width: 12px;
      height: 12px;
      min-width: 12px;
      border-radius: 50%;
      margin-left: 3px;
      border: 1px solid color-mix(in srgb, var(--ri-primary) 40%, white);
      color: var(--ri-primary);
      font-size: 9px;
      line-height: 10px;
    }

    .selected-portfolio-chip-row ::ng-deep .mat-mdc-chip-remove:hover {
      background: color-mix(in srgb, var(--ri-primary) 18%, white);
    }

    .toolbar-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: auto;

      @media (max-width: 768px) {
        width: 100%;
        justify-content: space-between;
      }
    }

    .toolbar-meta button[mat-stroked-button] {
      border-radius: 999px;
      padding-inline: 10px;
      min-height: 28px;
      height: 28px;
      line-height: 1;
      font-size: 11px;
      font-weight: 600;
      border-color: color-mix(in srgb, var(--ri-primary) 34%, var(--ri-outline-variant));
    }

    .last-updated {
      padding: 3px 8px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ri-primary) 8%, white);
      border: 1px solid color-mix(in srgb, var(--ri-primary) 18%, white);
      margin: 0;
      font-size: 10px;
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
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

      mat-card-header {
        padding: 10px 14px 0;
        margin: 0;
      }

      mat-card-title {
        font-size: 12px;
        font-weight: 700;
        color: var(--ri-on-surface-variant);
        margin: 0;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      mat-card-content {
        padding: 8px 14px 14px;
      }

      .metric-value {
        font-size: 26px;
        font-weight: 700;
        color: var(--ri-primary);
        margin: 0 0 4px 0;
      }

      .metric-detail {
        color: var(--ri-on-surface-variant);
        font-size: 11px;
        margin: 0;
      }
    }

    .section-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      margin-bottom: 24px;

      mat-card-header {
        padding: 16px 20px 0;
        margin: 0;
      }

      mat-card-title {
        font-size: 16px;
        font-weight: 700;
        margin: 0;
      }

      mat-card-content {
        padding: 12px 20px 20px;
        color: var(--ri-on-surface-variant);
      }
    }

    .scorecards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .executive-card h3 {
      margin: 0;
      color: var(--ri-on-surface);
      font-size: 15px;
    }

    .executive-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }

    .executive-block {
      border: 1px solid var(--ri-outline-variant);
      border-radius: 12px;
      padding: 16px;
      background: linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%);
    }

    .executive-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }

    .executive-meta {
      margin: 0 0 12px 0;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .executive-pill {
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .rag-red {
      background: #ffebee;
      color: #ba1a1a;
    }

    .rag-amber {
      background: #fff8e1;
      color: #f9a825;
    }

    .rag-green {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .executive-stats-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }

    .executive-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid var(--ri-outline-variant);
    }

    .executive-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--ri-primary);
    }

    .executive-stat-label {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
    }

    .executive-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .executive-list-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--ri-outline-variant);
    }

    .executive-forecast-copy {
      font-size: 12px;
      color: var(--ri-on-surface-variant);
      text-align: right;
    }

    .list-row {
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }

    .attention-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .attention-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 10px;
      background: #fafafa;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }
    }

    .attention-primary {
      flex: 1;
      min-width: 0;
    }

    .attention-headline-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }

    .attention-project {
      font-size: 14px;
      font-weight: 600;
      color: var(--ri-on-surface);
    }

    .attention-summary {
      margin: 0;
      font-size: 12px;
      color: var(--ri-on-surface-variant);
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

    /* Phase 1: Team Capacity Styles */
    .teams-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 12px;
    }

    .team-card {
      border: 1px solid var(--ri-outline-variant);
      border-radius: 10px;
      padding: 16px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fb 100%);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .team-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid var(--ri-outline-variant);
      padding-bottom: 8px;

      h4 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--ri-on-surface);
      }
    }

    .team-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
    }

    .team-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: center;
      padding: 8px;
      background: white;
      border-radius: 6px;
      border: 1px solid var(--ri-outline-variant);

      .stat-value {
        font-size: 18px;
        font-weight: 700;
        color: var(--ri-primary);
      }

      .stat-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .team-alert {
      padding: 8px 10px;
      background: #fff3cd;
      border-left: 3px solid #f9a825;
      border-radius: 4px;
      font-size: 12px;
      color: #856404;
      font-weight: 600;
    }

    .top-risks {
      display: flex;
      flex-direction: column;
      gap: 6px;

      .mini-label {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        color: var(--ri-on-surface-variant);
      }

      .risk-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;
        color: var(--ri-on-surface);
      }
    }

    .summary-text {
      margin: 0;
      padding: 8px 0;
      font-size: 12px;
      color: #f9a825;
      font-weight: 600;
    }

    /* Phase 1: Quality Snapshot Styles */
    .quality-overview {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
      align-items: center;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .quality-gauge {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .gauge-circle {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      gap: 4px;

      &.quality-high {
        background: #e8f5e9;
        border: 3px solid #2e7d32;
      }

      &.quality-medium {
        background: #fff8e1;
        border: 3px solid #f9a825;
      }

      &.quality-low {
        background: #ffebee;
        border: 3px solid #ba1a1a;
      }

      .gauge-value {
        font-size: 32px;
        color: inherit;
      }

      .gauge-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .gauge-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .gauge-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      text-align: center;

      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--ri-primary);
      }

      .stat-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .quality-table {
      border-top: 1px solid var(--ri-outline-variant);
      padding-top: 12px;

      .table-label {
        margin: 0 0 8px 0;
        font-size: 12px;
        font-weight: 700;
        color: var(--ri-on-surface-variant);
      }

      .table-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--ri-outline-variant);
        font-size: 13px;

        &:last-child {
          border-bottom: none;
        }

        .project-name {
          font-weight: 500;
          color: var(--ri-on-surface);
          flex: 1;
        }

        .quality-row-stats {
          display: flex;
          align-items: center;
          gap: 12px;

          .quality-score {
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;

            &.quality-high {
              background: #e8f5e9;
              color: #2e7d32;
            }

            &.quality-medium {
              background: #fff8e1;
              color: #f9a825;
            }

            &.quality-low {
              background: #ffebee;
              color: #ba1a1a;
            }
          }

          .team-label {
            font-size: 11px;
            color: var(--ri-on-surface-variant);
          }
        }
      }
    }

    /* Phase 1: Timeline Health Styles */
    .timeline-overview {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 24px;
      margin-bottom: 20px;
      align-items: center;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .timeline-metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .metric-circle {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: 700;

      &.healthy {
        background: #e8f5e9;
        border: 4px solid #2e7d32;
        color: #2e7d32;
      }

      &.at-risk {
        background: #fff3cd;
        border: 4px solid #f9a825;
        color: #f9a825;
      }
    }

    .metric-label {
      font-size: 13px;
      font-weight: 700;
      color: var(--ri-on-surface-variant);
    }

    .timeline-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;

      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .timeline-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      text-align: center;
      border-left: 3px solid #e0e0e0;

      &.warn {
        background: #fff8e1;
        border-left-color: #f9a825;
      }

      &.alert {
        background: #ffebee;
        border-left-color: #ba1a1a;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--ri-primary);
      }

      .stat-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .critical-path {
      margin-bottom: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--ri-outline-variant);

      .path-label {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 700;
        color: #ba1a1a;
      }

      .path-item {
        padding: 12px;
        margin-bottom: 8px;
        background: #ffebee;
        border-left: 3px solid #ba1a1a;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;

        @media (max-width: 768px) {
          flex-direction: column;
          align-items: flex-start;
        }

        .path-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;

          .path-name {
            font-weight: 600;
            color: #ba1a1a;
            font-size: 13px;
          }

          .path-status {
            font-size: 11px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;

            &.status-on_track {
              background: #e8f5e9;
              color: #2e7d32;
            }

            &.status-at_risk {
              background: #fff8e1;
              color: #f9a825;
            }

            &.status-delayed {
              background: #ffebee;
              color: #ba1a1a;
            }
          }
        }

        .path-metrics {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 12px;
          font-weight: 600;

          .path-metric {
            color: var(--ri-on-surface-variant);

            &.warn {
              color: #f9a825;
            }

            &.velocity-weak {
              color: #ba1a1a;
            }

            &.velocity-nominal {
              color: #f9a825;
            }

            &.velocity-strong {
              color: #2e7d32;
            }
          }
        }
      }
    }

    .early-warnings {
      .warning-label {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 700;
        color: #f9a825;
      }

      .warning-item {
        padding: 10px 12px;
        margin-bottom: 6px;
        background: #fff8e1;
        border-left: 3px solid #f9a825;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        font-size: 12px;

        .warning-project {
          font-weight: 600;
          color: #856404;
          flex: 1;
        }

        .warning-reason {
          color: #856404;
          font-size: 11px;
        }
      }
    }

    .dependency-overview {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;

      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .dependency-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      text-align: center;
      border-left: 3px solid #e0e0e0;

      &.warn {
        background: #fff8e1;
        border-left-color: #f9a825;
      }

      &.alert {
        background: #ffebee;
        border-left-color: #ba1a1a;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--ri-primary);
      }

      .stat-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .dependency-list {
      border-top: 1px solid var(--ri-outline-variant);
      padding-top: 16px;

      .dependency-label {
        margin: 0 0 12px 0;
        font-size: 13px;
        font-weight: 700;
        color: #ba1a1a;
      }

      .dependency-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        margin-bottom: 8px;
        background: #fff8e1;
        border-left: 3px solid #f57c00;
        border-radius: 4px;

        @media (max-width: 768px) {
          flex-direction: column;
          align-items: flex-start;
        }
      }

      .dependency-path {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;

        .source,
        .target {
          font-weight: 600;
          color: #7a3e00;
        }

        .arrow {
          color: #f57c00;
          font-weight: 700;
        }
      }

      .dependency-meta {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .team-link {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .release-overview {
      display: grid;
      grid-template-columns: 180px 1fr;
      gap: 16px;
      align-items: center;
      margin-bottom: 14px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .release-gauge {
      width: 160px;
      height: 160px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin: 0 auto;

      .gauge-value {
        font-size: 32px;
        font-weight: 700;
      }

      .gauge-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .release-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;

      @media (max-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .release-stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      border-radius: 8px;
      background: #f5f5f5;
      border-left: 3px solid #e0e0e0;
      text-align: center;

      &.warn {
        background: #fff8e1;
        border-left-color: #f9a825;
      }

      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--ri-primary);
      }

      .stat-label {
        font-size: 11px;
        color: var(--ri-on-surface-variant);
      }
    }

    .checklist-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .check-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      border: 1px solid var(--ri-outline-variant);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .release-table {
      border-top: 1px solid var(--ri-outline-variant);
      padding-top: 12px;
    }
  `],
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly MAX_TREND_RETRY_ATTEMPTS = 3;
  private readonly TREND_RETRY_BASE_MS = 1000;
  private readonly TREND_RETRY_MAX_MS = 8000;

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
  latestExecutiveReport: ExecutiveReport | null = null;
  latestPortfolioForecast: PortfolioForecast | null = null;
  fallbackExecutiveSnapshot: ExecutiveSnapshotFallback | null = null;
  attentionItems: AttentionItem[] = [];
  projectTrendDirections: Record<string, TrendDirection> = {};
  projectTrendLoading: Record<string, boolean> = {};
  projectTrendUpdatedAt: Record<string, string | null> = {};
  projectTrendAgeStatus: Record<string, TrendAgeStatus> = {};
  projectTrendRetryAttempts: Record<string, number> = {};
  projectTrendNextRetryAt: Record<string, number> = {};
  retryNow = Date.now();
  selectedPortfolioId = '';
  portfolioOptions: PortfolioOption[] = [];
  selectedPortfolio: PortfolioOption | null = null;
  portfolioInputControl = new FormControl('', { nonNullable: true });

  // Phase 1 Dashboard Metrics
  teamCapacity: TeamCapacityMetrics | null = null;
  qualitySnapshot: QualitySnapshot | null = null;
  timelineHealth: TimelineHealth | null = null;
  dependencyMap: DependencyMap | null = null;
  releaseReadiness: ReleaseReadiness | null = null;
  budgetHealth: BudgetHealth | null = null;
  recommendationAdoption: RecommendationAdoption | null = null;
  ownerWorkload: OwnerWorkload | null = null;

  private retryTickHandle: number | null = null;
  private authStateSubscription: Subscription | null = null;

  constructor(
    private projectsService: ProjectsService,
    private authService: AuthService,
    private riskService: RiskService,
    private alertService: AlertService,
    private reportingService: ReportingService,
    private forecastService: ForecastService,
    private dashboardMetricsService: DashboardMetricsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.startRetryTicker();

    this.authStateSubscription = this.authService.user$.subscribe((user) => {
      // Initial dashboard load can happen before auth bootstrap finishes.
      // Reload once an authenticated user is available to populate protected project catalog data.
      if (user && !this.loading && !this.portfolioOptions.length) {
        this.loadDashboard();
      }
    });

    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.authStateSubscription?.unsubscribe();
    this.stopRetryTicker();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';
    const scopedFilters = this.getScopedPortfolioFilter();

    forkJoin({
      projectCatalog: this.projectsService.getProjects().pipe(catchError(() => of({ projects: [], total: 0 }))),
      projects: this.projectsService.getProjects(scopedFilters).pipe(catchError(() => of({ projects: [], total: 0 }))),
      risks: this.riskService.refreshRiskScores().pipe(catchError(() => of([]))),
      anomalies: this.riskService.getPortfolioAnomalies().pipe(catchError(() => of([]))),
      alerts: this.alertService.getPortfolioAlerts().pipe(catchError(() => of({ totalActive: 0, alerts: [] }))),
      reports: this.reportingService.listReports().pipe(catchError(() => of({ reports: [], total: 0 }))),
      forecasts: this.forecastService.list({ forecastType: 'PORTFOLIO' }).pipe(catchError(() => of({ forecasts: [], total: 0 }))),
      dashboardMetrics: this.dashboardMetricsService.getDashboardMetrics(scopedFilters).pipe(catchError(() => of(null))),
    })
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(({ projectCatalog, projects, risks, anomalies, alerts, reports, forecasts, dashboardMetrics }) => {
        const projectIds = new Set((projects.projects || []).map((project) => project.id));
        const scopedRiskScores = (risks as RiskScore[]).filter((risk) => projectIds.has(risk.projectId));
        const scopedAnomalies = (anomalies as ProjectAnomaly[]).filter((anomaly) => projectIds.has(anomaly.projectId));
        const scopedAlerts = (alerts.alerts || []).filter((alert) => projectIds.has(alert.projectId));

        this.portfolioOptions = this.buildPortfolioOptions(projectCatalog.projects || []);
        this.syncSelectedPortfolioOption();

        if (!projects.projects.length && !scopedRiskScores.length) {
          this.errorMessage = 'Dashboard data is unavailable. Verify gateway and project services are healthy.';
          return;
        }

        // Store Phase 1 metrics
        this.teamCapacity = (dashboardMetrics?.teamCapacity as TeamCapacityMetrics | null) ?? null;
        this.qualitySnapshot = (dashboardMetrics?.qualitySnapshot as QualitySnapshot | null) ?? null;
        this.timelineHealth = (dashboardMetrics?.timelineHealth as TimelineHealth | null) ?? null;
        this.dependencyMap = (dashboardMetrics?.dependencyMap as DependencyMap | null) ?? null;
        this.releaseReadiness = (dashboardMetrics?.releaseReadiness as ReleaseReadiness | null) ?? null;
        this.budgetHealth = (dashboardMetrics?.budgetHealth as BudgetHealth | null) ?? null;
        this.recommendationAdoption = (dashboardMetrics?.recommendationAdoption as RecommendationAdoption | null) ?? null;
        this.ownerWorkload = (dashboardMetrics?.ownerWorkload as OwnerWorkload | null) ?? null;

        const highRiskCount = scopedRiskScores.filter(score => score.band === 'HIGH' || score.band === 'CRITICAL').length;
        const lowRiskCount = scopedRiskScores.filter(score => score.band === 'LOW').length;
        const avgRiskScore = scopedRiskScores.length
          ? Math.round(scopedRiskScores.reduce((sum, score) => sum + score.score, 0) / scopedRiskScores.length)
          : 0;

        this.metrics = {
          openHighRisks: highRiskCount,
          activeProjects: projects.total || projects.projects.length,
          avgProbability: avgRiskScore,
          lowRiskProjects: lowRiskCount,
        };

        this.topRisks = [...scopedRiskScores]
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        this.loadScorecardTrends(this.topRisks);

        this.topAnomalies = [...scopedAnomalies]
          .sort((a, b) => b.anomalyScore - a.anomalyScore)
          .slice(0, 5);

        this.topAlerts = [...scopedAlerts]
          .sort((a, b) => b.breachCount - a.breachCount)
          .slice(0, 5);

        this.latestExecutiveReport = (reports.reports?.[0] as ExecutiveReport | undefined) || null;
        this.latestPortfolioForecast = (forecasts.forecasts?.[0] as PortfolioForecast | undefined) || null;
        this.fallbackExecutiveSnapshot = !this.latestExecutiveReport
          ? this.buildFallbackExecutiveSnapshot()
          : null;
        this.attentionItems = this.buildAttentionItems();

        this.lastUpdated = new Date().toLocaleString();
      });
  }

  onPortfolioSelectionChange(portfolioId: string): void {
    this.selectedPortfolioId = portfolioId || '';
    this.syncSelectedPortfolioOption();
    this.loadDashboard();
  }

  onPortfolioOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedValue = event.option.value;

    if (!selectedValue) {
      this.selectedPortfolio = null;
      this.selectedPortfolioId = '';
      this.portfolioInputControl.setValue('');
      this.blurPortfolioInput();
      this.loadDashboard();
      return;
    }

    const portfolio = selectedValue as PortfolioOption;
    this.selectedPortfolio = portfolio;
    this.selectedPortfolioId = portfolio.id;
    this.portfolioInputControl.setValue('');
    this.blurPortfolioInput();
    this.loadDashboard();
  }

  clearPortfolioSelection(): void {
    if (!this.selectedPortfolioId) {
      return;
    }

    this.selectedPortfolio = null;
    this.selectedPortfolioId = '';
    this.portfolioInputControl.setValue('');
    this.blurPortfolioInput();
    this.loadDashboard();
  }

  private blurPortfolioInput(): void {
    if (typeof document === 'undefined') {
      return;
    }

    // Delay blur slightly so keyboard option selection doesn't re-focus the input.
    setTimeout(() => {
      const input = document.getElementById('portfolio-chip-input') as HTMLInputElement | null;
      input?.blur();
    }, 60);
  }

  getFilteredPortfolioOptions(): PortfolioOption[] {
    const query = (this.portfolioInputControl.value || '').toLowerCase().trim();

    return this.portfolioOptions.filter((portfolio) => {
      if (portfolio.id === this.selectedPortfolioId) {
        return false;
      }

      if (!query) {
        return true;
      }

      return portfolio.name.toLowerCase().includes(query) || portfolio.id.toLowerCase().includes(query);
    });
  }

  private getScopedPortfolioFilter(): { portfolioId?: string } {
    if (!this.selectedPortfolioId) {
      return {};
    }

    return { portfolioId: this.selectedPortfolioId };
  }

  private buildPortfolioOptions(projects: Array<{ portfolioId?: string; portfolioName?: string }>): PortfolioOption[] {
    const optionsById = new Map<string, PortfolioOption>();

    for (const project of projects) {
      if (!project.portfolioId) {
        continue;
      }

      if (!optionsById.has(project.portfolioId)) {
        optionsById.set(project.portfolioId, {
          id: project.portfolioId,
          name: project.portfolioName || project.portfolioId,
        });
      }
    }

    return [...optionsById.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  private syncSelectedPortfolioOption(): void {
    if (!this.selectedPortfolioId) {
      this.selectedPortfolio = null;
      return;
    }

    this.selectedPortfolio = this.portfolioOptions.find((portfolio) => portfolio.id === this.selectedPortfolioId) || null;
    if (!this.selectedPortfolio) {
      this.selectedPortfolioId = '';
    }
  }

  private buildAttentionItems(): AttentionItem[] {
    const candidates: AttentionItem[] = [];

    for (const risk of this.topRisks.slice(0, 3)) {
      if (risk.band === 'HIGH' || risk.band === 'CRITICAL') {
        candidates.push({
          category: 'high_risk',
          projectId: risk.projectId,
          projectName: risk.projectName,
          summary: `High risk score (${risk.score}) requires remediation and owner alignment.`,
          severity: risk.band,
          actionLabel: 'Open Risk Details',
          priorityScore: risk.band === 'CRITICAL' ? 100 : 85,
        });
      }
    }

    const topDependency = this.dependencyMap?.atRiskDependencies?.[0];
    if (topDependency) {
      candidates.push({
        category: 'dependency',
        projectId: topDependency.targetProjectId,
        projectName: topDependency.targetProjectName,
        summary: `Blocked by ${topDependency.sourceProjectName} (${topDependency.blockerRiskBand} ${topDependency.blockerRiskScore}).`,
        severity: topDependency.blockerRiskBand,
        actionLabel: 'Review Blocker',
        priorityScore: topDependency.blockerRiskBand === 'CRITICAL' ? 95 : 80,
      });
    }

    const topOverrun = this.budgetHealth?.topOverruns?.[0];
    if (topOverrun && topOverrun.budgetStatus === 'over_budget') {
      candidates.push({
        category: 'budget',
        projectId: topOverrun.projectId,
        projectName: topOverrun.projectName,
        summary: `Budget variance at ${topOverrun.variancePercentage}%. Planned ${Math.round(topOverrun.plannedBudget)} vs projected ${Math.round(topOverrun.projectedSpend)}.`,
        severity: 'HIGH',
        actionLabel: 'Review Budget',
        priorityScore: 78,
      });
    }

    const topRecommendation = this.recommendationAdoption?.topRecommendations?.find((item) => item.priority === 'P1');
    if (topRecommendation) {
      candidates.push({
        category: 'recommendation',
        projectId: topRecommendation.projectId,
        projectName: topRecommendation.projectName,
        summary: `P1 recommendation: ${topRecommendation.title}. Confidence ${topRecommendation.confidence}%.`,
        severity: 'HIGH',
        actionLabel: 'Open Recommendation',
        priorityScore: 74,
      });
    }

    const overloadedOwner = this.ownerWorkload?.topOwners?.find((owner) => owner.workloadRiskLevel === 'HIGH');
    if (overloadedOwner) {
      candidates.push({
        category: 'owner',
        projectName: overloadedOwner.ownerRole,
        summary: `${overloadedOwner.recommendationCount} recommendations with ${overloadedOwner.highPriorityCount} P1 items across ${overloadedOwner.projectCount} projects.`,
        severity: 'MEDIUM',
        actionLabel: 'Open Workload View',
        priorityScore: 62,
      });
    }

    return candidates.sort((left, right) => right.priorityScore - left.priorityScore);
  }

  takeAttentionAction(item: AttentionItem): void {
    if ((item.category === 'high_risk' || item.category === 'dependency' || item.category === 'recommendation') && item.projectId) {
      this.openAnomalyDetail(item.projectId);
      return;
    }

    if (item.category === 'budget') {
      this.router.navigate(['/projects']);
      return;
    }

    if (item.category === 'owner') {
      this.router.navigate(['/engineering']);
      return;
    }

    this.router.navigate(['/risk']);
  }

  private buildFallbackExecutiveSnapshot(): ExecutiveSnapshotFallback | null {
    if (!this.metrics.activeProjects && !this.topRisks.length) {
      return null;
    }

    return {
      overallRag: this.metrics.openHighRisks >= 2 ? 'RED' : this.metrics.openHighRisks === 1 ? 'AMBER' : 'GREEN',
      totalProjects: this.metrics.activeProjects,
      atRiskProjects: this.metrics.openHighRisks,
      averageRiskScore: this.metrics.avgProbability,
      openRecommendations: this.recommendationAdoption?.activeRecommendations || 0,
      generatedAt: new Date().toISOString(),
      highlights: this.topRisks.slice(0, 3).map((risk) => ({
        projectName: risk.projectName,
        riskScore: risk.score,
        rag: risk.band === 'CRITICAL' || risk.band === 'HIGH' ? 'RED' : risk.band === 'MEDIUM' ? 'AMBER' : 'GREEN',
      })),
    };
  }

  openAnomalyDetail(projectId: string): void {
    this.router.navigate(['/risk/anomalies', projectId]);
  }

  getTopAnomalyAction(anomaly: ProjectAnomaly): string {
    return getRecommendedActionsForAnomaly(anomaly)[0] || 'Continue monitoring and re-evaluate on next snapshot.';
  }

  isRetryDisabled(projectId: string): boolean {
    const attempts = this.projectTrendRetryAttempts[projectId] || 0;
    const nextRetryAt = this.projectTrendNextRetryAt[projectId] || 0;
    return attempts >= this.MAX_TREND_RETRY_ATTEMPTS || this.retryNow < nextRetryAt || this.projectTrendLoading[projectId] === true;
  }

  getRetryHint(projectId: string): string | null {
    const attempts = this.projectTrendRetryAttempts[projectId] || 0;
    if (attempts >= this.MAX_TREND_RETRY_ATTEMPTS) {
      return 'Retry limit reached. Refresh dashboard to reset.';
    }

    const remainingMs = (this.projectTrendNextRetryAt[projectId] || 0) - this.retryNow;
    if (remainingMs > 0) {
      return `Retry available in ${Math.ceil(remainingMs / 1000)}s`;
    }

    return null;
  }

  retryProjectTrend(projectId: string): void {
    if (!projectId || !(projectId in this.projectTrendDirections)) {
      return;
    }

    const now = this.retryNow;
    const attempts = this.projectTrendRetryAttempts[projectId] || 0;
    const nextRetryAt = this.projectTrendNextRetryAt[projectId] || 0;
    if (attempts >= this.MAX_TREND_RETRY_ATTEMPTS || now < nextRetryAt || this.projectTrendLoading[projectId]) {
      return;
    }

    this.projectTrendLoading = { ...this.projectTrendLoading, [projectId]: true };

    this.riskService.getProjectRiskTrend(projectId).pipe(
      map((trend) => ({ trend, fetchFailed: false })),
      catchError(() => of({ trend: null, fetchFailed: true }))
    ).subscribe((trendResult) => {
      if (trendResult.fetchFailed) {
        const nextAttempt = attempts + 1;
        const backoffMs = Math.min(
          this.TREND_RETRY_MAX_MS,
          this.TREND_RETRY_BASE_MS * Math.pow(2, Math.max(0, nextAttempt - 1))
        );

        this.projectTrendDirections = { ...this.projectTrendDirections, [projectId]: 'fetch_failed' };
        this.projectTrendUpdatedAt = { ...this.projectTrendUpdatedAt, [projectId]: null };
        this.projectTrendAgeStatus = { ...this.projectTrendAgeStatus, [projectId]: null };
        this.projectTrendRetryAttempts = { ...this.projectTrendRetryAttempts, [projectId]: nextAttempt };
        this.projectTrendNextRetryAt = { ...this.projectTrendNextRetryAt, [projectId]: now + backoffMs };
        this.projectTrendLoading = { ...this.projectTrendLoading, [projectId]: false };
        return;
      }

      const trendPayload = trendResult.trend as ProjectRiskTrend | null;
      const latestSnapshotAt = this.getLatestTrendSnapshotAt(trendPayload);

      this.projectTrendDirections = {
        ...this.projectTrendDirections,
        [projectId]: trendPayload?.trend ?? 'insufficient_data',
      };
      this.projectTrendUpdatedAt = { ...this.projectTrendUpdatedAt, [projectId]: latestSnapshotAt };
      this.projectTrendAgeStatus = { ...this.projectTrendAgeStatus, [projectId]: this.getTrendAgeStatus(latestSnapshotAt) };
      this.projectTrendRetryAttempts = { ...this.projectTrendRetryAttempts, [projectId]: 0 };
      this.projectTrendNextRetryAt = { ...this.projectTrendNextRetryAt, [projectId]: 0 };
      this.projectTrendLoading = { ...this.projectTrendLoading, [projectId]: false };
    });
  }

  private loadScorecardTrends(risks: RiskScore[]): void {
    const topScorecardIds = risks.slice(0, 3).map((risk) => risk.projectId);
    if (!topScorecardIds.length) {
      this.projectTrendDirections = {};
      this.projectTrendLoading = {};
      this.projectTrendUpdatedAt = {};
      this.projectTrendAgeStatus = {};
      this.projectTrendRetryAttempts = {};
      this.projectTrendNextRetryAt = {};
      return;
    }

    this.projectTrendLoading = topScorecardIds.reduce((acc, projectId) => {
      acc[projectId] = true;
      return acc;
    }, {} as Record<string, boolean>);
    this.projectTrendUpdatedAt = topScorecardIds.reduce((acc, projectId) => {
      acc[projectId] = null;
      return acc;
    }, {} as Record<string, string | null>);
    this.projectTrendAgeStatus = topScorecardIds.reduce((acc, projectId) => {
      acc[projectId] = null;
      return acc;
    }, {} as Record<string, TrendAgeStatus>);
    this.projectTrendRetryAttempts = topScorecardIds.reduce((acc, projectId) => {
      acc[projectId] = 0;
      return acc;
    }, {} as Record<string, number>);
    this.projectTrendNextRetryAt = topScorecardIds.reduce((acc, projectId) => {
      acc[projectId] = 0;
      return acc;
    }, {} as Record<string, number>);

    const trendRequests = topScorecardIds.map((projectId) =>
      this.riskService.getProjectRiskTrend(projectId).pipe(
        map((trend) => ({ trend, fetchFailed: false })),
        catchError(() => of({ trend: null, fetchFailed: true }))
      )
    );

    forkJoin(trendRequests).subscribe((trends) => {
      const nextTrends: Record<string, TrendDirection> = {};
      const nextLoading: Record<string, boolean> = {};
      const nextUpdatedAt: Record<string, string | null> = {};
      const nextAgeStatus: Record<string, TrendAgeStatus> = {};
      trends.forEach((trendResult, index) => {
        const projectId = topScorecardIds[index];

        if (trendResult.fetchFailed) {
          nextTrends[projectId] = 'fetch_failed';
          nextLoading[projectId] = false;
          nextUpdatedAt[projectId] = null;
          nextAgeStatus[projectId] = null;
          return;
        }

        const trendPayload = trendResult.trend as ProjectRiskTrend | null;
        nextTrends[projectId] = trendPayload?.trend ?? 'insufficient_data';
        nextLoading[projectId] = false;
        const latestSnapshotAt = this.getLatestTrendSnapshotAt(trendPayload);
        nextUpdatedAt[projectId] = latestSnapshotAt;
        nextAgeStatus[projectId] = this.getTrendAgeStatus(latestSnapshotAt);
      });
      this.projectTrendDirections = nextTrends;
      this.projectTrendLoading = nextLoading;
      this.projectTrendUpdatedAt = nextUpdatedAt;
      this.projectTrendAgeStatus = nextAgeStatus;
    });
  }

  private getLatestTrendSnapshotAt(trend: ProjectRiskTrend | null): string | null {
    if (!trend?.snapshots?.length) {
      return null;
    }
    return trend.snapshots[trend.snapshots.length - 1].snapshotAt;
  }

  private getTrendAgeStatus(snapshotAt: string | null): TrendAgeStatus {
    if (!snapshotAt) {
      return null;
    }
    const ageMs = Date.now() - new Date(snapshotAt).getTime();
    return ageMs <= 24 * 60 * 60 * 1000 ? 'fresh' : 'stale';
  }

  getAlertSeverityChipClass(alert: ProjectAlert): string {
    const severity = (alert.severity || 'LOW').toLowerCase();
    return `risk-${severity}`;
  }

  private startRetryTicker(): void {
    if (this.retryTickHandle !== null) {
      return;
    }
    this.retryTickHandle = window.setInterval(() => {
      this.retryNow = Date.now();
    }, 1000);
  }

  private stopRetryTicker(): void {
    if (this.retryTickHandle !== null) {
      clearInterval(this.retryTickHandle);
      this.retryTickHandle = null;
    }
  }
}
