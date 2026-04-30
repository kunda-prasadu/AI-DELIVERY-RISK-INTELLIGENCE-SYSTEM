import { Component, HostListener, OnInit } from '@angular/core';
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

type TelemetryNavigatorSortOrder = 'newest' | 'oldest';

type TelemetryNavigatorPreset = 'focus' | 'explore' | 'custom';

interface TelemetryNavigatorPreferences {
  continuousMode: boolean;
  sortOrder: TelemetryNavigatorSortOrder;
  pageSize: number;
  minRate: number;
  pinnedOnlyMode: boolean;
  activePreset: TelemetryNavigatorPreset;
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
              <button mat-stroked-button type="button" (click)="exportTelemetryWindowCsv()">
                Export CSV
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
            <button mat-stroked-button type="button" (click)="toggleTelemetryShortcutHelp()">
              {{ telemetryShortcutHelpOpen ? 'Hide' : 'Show' }} Shortcuts
            </button>
            <span style="font-size:12px;color:var(--ri-on-surface-variant);align-self:center;">
              Shortcut key: ?
            </span>
          </div>

          <div *ngIf="telemetryShortcutHelpOpen" style="margin-bottom:12px;padding:8px 10px;border:1px solid var(--ri-outline);border-radius:8px;background:var(--ri-surface);font-size:12px;color:var(--ri-on-surface-variant);display:flex;gap:10px;flex-wrap:wrap;">
            <span><strong>Pan:</strong> ← / →</span>
            <span><strong>Jump:</strong> J / K</span>
            <span><strong>Live:</strong> L</span>
            <span><strong>Close:</strong> Esc</span>
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
            <button
              type="button"
              class="telemetry-row"
              *ngFor="let point of getTelemetryTimelinePoints()"
              [class.telemetry-row-active]="isActiveTelemetryPoint(point)"
              [attr.aria-pressed]="isActiveTelemetryPoint(point)"
              style="width:100%;text-align:left;cursor:pointer;font:inherit;"
              (click)="selectTelemetryTimelinePoint(point)"
              (focus)="setHoveredTelemetryPoint(point)"
              (blur)="clearHoveredTelemetryPoint()">
              <span class="telemetry-time">{{ formatDateTime(point.timestamp) }}</span>
              <span class="telemetry-rate">{{ point.adoptionRate }}%</span>
              <span class="telemetry-meta">{{ point.completedCount }} completed · {{ point.inProgressCount }} in progress</span>
            </button>
          </div>

          <div *ngIf="getTelemetryNavigatorPoints().length" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
              <span style="font-size:12px;color:var(--ri-on-surface-variant);font-weight:600;">Jump To Older Snapshot</span>
              <span style="font-size:12px;color:var(--ri-on-surface-variant);font-weight:600;">Pins {{ telemetryNavigatorPinnedTimestamps.length }}/{{ telemetryNavigatorMaxPins }}</span>
              <span style="font-size:12px;color:var(--ri-on-surface-variant);font-weight:600;">Preset {{ getTelemetryNavigatorPresetLabel() }}</span>
              <div style="display:flex;gap:8px;">
                <button mat-stroked-button type="button" (click)="recenterTelemetryToLiveEdge()" [disabled]="!canRecenterTelemetryToLiveEdge()">Back To Live</button>
                <button mat-stroked-button type="button" (click)="toggleTelemetryNavigatorContinuousMode()">Continuous {{ telemetryNavigatorContinuousMode ? 'On' : 'Off' }}</button>
                <button mat-stroked-button type="button" (click)="toggleTelemetryNavigatorSortOrder()">Order {{ telemetryNavigatorSortOrder === 'newest' ? 'Newest' : 'Oldest' }} First</button>
                <button mat-stroked-button type="button" (click)="shiftTelemetryNavigator('older')" [disabled]="!canShiftTelemetryNavigatorOlder()">Older Jumps</button>
                <button mat-stroked-button type="button" (click)="shiftTelemetryNavigator('newer')" [disabled]="!canShiftTelemetryNavigatorNewer()">Newer Jumps</button>
                <button mat-stroked-button type="button" (click)="applyTelemetryNavigatorPreset('focus')">Preset Focus</button>
                <button mat-stroked-button type="button" (click)="applyTelemetryNavigatorPreset('explore')">Preset Explore</button>
                <button mat-stroked-button type="button" (click)="resetTelemetryNavigatorPreferences()">Reset Nav Prefs</button>
                <button mat-stroked-button type="button" (click)="toggleTelemetryNavigatorPinnedOnlyMode()" [disabled]="!telemetryNavigatorPinnedTimestamps.length && !telemetryNavigatorPinnedOnlyMode">Pinned Only {{ telemetryNavigatorPinnedOnlyMode ? 'On' : 'Off' }}</button>
                <button mat-stroked-button type="button" (click)="pinVisibleTelemetryNavigatorPoints()" [disabled]="!canPinVisibleTelemetryNavigatorPoints()">Pin Visible</button>
                <button mat-stroked-button type="button" (click)="clearTelemetryNavigatorPins()" [disabled]="!telemetryNavigatorPinnedTimestamps.length">Unpin All</button>
                <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--ri-on-surface-variant);">Page Size
                  <select [value]="telemetryNavigatorPageSize" (change)="setTelemetryNavigatorPageSize($any($event.target).value)" style="padding:2px 4px;border:1px solid var(--ri-outline);border-radius:4px;font-size:12px;background:var(--ri-surface);color:inherit;">
                    <option *ngFor="let size of telemetryNavigatorPageSizeOptions" [value]="size">{{ size }}</option>
                  </select>
                </label>
                <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--ri-on-surface-variant);">Min Rate%
                  <input type="number" min="0" max="100" [value]="telemetryNavigatorMinRate" (change)="setTelemetryNavigatorMinRate($any($event.target).value)" style="width:52px;padding:2px 4px;border:1px solid var(--ri-outline);border-radius:4px;font-size:12px;background:var(--ri-surface);color:inherit;">
                </label>
              </div>
            </div>
            <div *ngIf="telemetryNavigatorPinLimitMessage" style="font-size:12px;color:#b3261e;font-weight:600;">
              {{ telemetryNavigatorPinLimitMessage }}
            </div>
            <div *ngIf="getPinnedTelemetryNavigatorPoints().length" style="display:flex;flex-direction:column;gap:6px;padding:8px;border:1px dashed var(--ri-outline);border-radius:8px;background:var(--ri-surface);">
              <span style="font-size:12px;color:var(--ri-on-surface-variant);font-weight:600;">Pinned Snapshots</span>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <div *ngFor="let pinnedPoint of getPinnedTelemetryNavigatorPoints()" style="display:flex;gap:4px;align-items:center;">
                  <button mat-stroked-button type="button" (click)="jumpToPinnedTelemetrySnapshot(pinnedPoint.timestamp)">
                    {{ formatTime(pinnedPoint.timestamp) }} · {{ pinnedPoint.adoptionRate }}%
                  </button>
                  <span style="font-size:11px;color:var(--ri-on-surface-variant);">{{ getPinnedSnapshotAgeLabel(pinnedPoint.timestamp) }}</span>
                  <span style="font-size:11px;color:var(--ri-on-surface-variant);">{{ getPinnedSnapshotContextLabel(pinnedPoint) }}</span>
                  <button mat-stroked-button type="button" (click)="unpinTelemetryNavigatorTimestamp(pinnedPoint.timestamp)">Unpin</button>
                </div>
              </div>
            </div>
            <div [style.display]="'flex'" [style.gap.px]="8" [style.flex-wrap]="telemetryNavigatorContinuousMode ? 'nowrap' : 'wrap'" [style.overflow-x]="telemetryNavigatorContinuousMode ? 'auto' : 'visible'" [style.padding-bottom.px]="telemetryNavigatorContinuousMode ? 4 : 0">
              <div
                *ngFor="let point of getTelemetryNavigatorPoints()"
                style="display:flex;gap:4px;align-items:center;flex:0 0 auto;">
                <button
                  mat-stroked-button
                  type="button"
                  [class.window-active]="isActiveTelemetryPoint(point)"
                  (click)="focusTelemetryPoint(point)">
                  {{ formatTime(point.timestamp) }} · {{ point.adoptionRate }}% ·
                  <span [style.color]="getTelemetryNavigatorDeltaColor(point)">Δ {{ formatTelemetryNavigatorDelta(point) }}</span>
                </button>
                <button
                  mat-stroked-button
                  type="button"
                  [attr.aria-label]="isTelemetryNavigatorPinned(point) ? 'Unpin Snapshot' : 'Pin Snapshot'"
                  (click)="toggleTelemetryNavigatorPin(point)">
                  {{ isTelemetryNavigatorPinned(point) ? 'Pinned' : 'Pin' }}
                </button>
              </div>
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

    .telemetry-row:focus-visible,
    .telemetry-row-active {
      border-color: var(--ri-primary);
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
  private readonly telemetryPinnedStorageKey = 'ri-action-telemetry-pins-v1';
  private readonly telemetryNavigatorPreferencesStorageKey = 'ri-action-telemetry-navigator-prefs-v1';
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
  telemetryNavigatorOffset = 0;
  telemetryNavigatorContinuousMode = false;
  telemetryNavigatorSortOrder: TelemetryNavigatorSortOrder = 'newest';
  telemetryNavigatorPageSize = 8;
  telemetryNavigatorMinRate = 0;
  telemetryNavigatorPinnedOnlyMode = false;
  telemetryNavigatorActivePreset: TelemetryNavigatorPreset = 'custom';
  telemetryNavigatorPinnedTimestamps: number[] = [];
  telemetryNavigatorPinLimitMessage = '';
  telemetryShortcutHelpOpen = false;
  readonly telemetrySeries: TelemetrySeriesDefinition[] = [
    { key: 'adoption', label: 'Adoption', color: '#3525cd' },
    { key: 'completed', label: 'Completed', color: '#0f9d58' },
    { key: 'inProgress', label: 'In Progress', color: '#ff8f00' },
  ];
  readonly telemetryZoomLevels: TelemetryZoomLevel[] = [1, 2, 4];
  readonly telemetryNavigatorPageSizeOptions = [5, 8, 15];
  readonly telemetryNavigatorMaxPins = 20;

  constructor(
    private riskService: RiskService,
    private projectsService: ProjectsService
  ) {}

  ngOnInit(): void {
    this.adoptionTelemetry = this.readTelemetry();
    this.telemetryNavigatorPinnedTimestamps = this.readPinnedTelemetryTimestamps();
    this.prunePinnedTelemetryTimestamps();
    this.applyTelemetryNavigatorPreferences();
    this.enforceTelemetryNavigatorPinQuota();
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

  private readPinnedTelemetryTimestamps(): number[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.telemetryPinnedStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return Array.from(new Set(parsed.filter((value) => typeof value === 'number')));
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

  private persistPinnedTelemetryTimestamps(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.telemetryPinnedStorageKey, JSON.stringify(this.telemetryNavigatorPinnedTimestamps));
    } catch {
      // Ignore storage failures to keep telemetry controls operational.
    }
  }

  private readTelemetryNavigatorPreferences(): Partial<TelemetryNavigatorPreferences> | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.telemetryNavigatorPreferencesStorageKey);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return parsed as Partial<TelemetryNavigatorPreferences>;
    } catch {
      return null;
    }
  }

  private persistTelemetryNavigatorPreferences(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const preferences: TelemetryNavigatorPreferences = {
      continuousMode: this.telemetryNavigatorContinuousMode,
      sortOrder: this.telemetryNavigatorSortOrder,
      pageSize: this.telemetryNavigatorPageSize,
      minRate: this.telemetryNavigatorMinRate,
      pinnedOnlyMode: this.telemetryNavigatorPinnedOnlyMode,
      activePreset: this.telemetryNavigatorActivePreset,
    };

    try {
      localStorage.setItem(this.telemetryNavigatorPreferencesStorageKey, JSON.stringify(preferences));
    } catch {
      // Ignore storage failures to keep telemetry controls responsive.
    }
  }

  private applyTelemetryNavigatorPreferences(): void {
    const preferences = this.readTelemetryNavigatorPreferences();
    if (!preferences) {
      return;
    }

    this.telemetryNavigatorContinuousMode = !!preferences.continuousMode;
    this.telemetryNavigatorSortOrder = preferences.sortOrder === 'oldest' ? 'oldest' : 'newest';

    const parsedPageSize = typeof preferences.pageSize === 'number'
      ? preferences.pageSize
      : parseInt(String(preferences.pageSize), 10);
    if (this.telemetryNavigatorPageSizeOptions.includes(parsedPageSize)) {
      this.telemetryNavigatorPageSize = parsedPageSize;
    }

    const parsedMinRate = typeof preferences.minRate === 'number'
      ? preferences.minRate
      : parseFloat(String(preferences.minRate));
    this.telemetryNavigatorMinRate = isNaN(parsedMinRate) ? 0 : Math.max(0, Math.min(100, parsedMinRate));

    this.telemetryNavigatorPinnedOnlyMode = !!preferences.pinnedOnlyMode && this.telemetryNavigatorPinnedTimestamps.length > 0;
    this.telemetryNavigatorActivePreset = preferences.activePreset === 'focus' || preferences.activePreset === 'explore'
      ? preferences.activePreset
      : 'custom';
    this.persistTelemetryNavigatorPreferences();
  }

  private prunePinnedTelemetryTimestamps(): void {
    const validTimestamps = new Set(this.adoptionTelemetry.map((point) => point.timestamp));
    const pruned = this.telemetryNavigatorPinnedTimestamps.filter((timestamp) => validTimestamps.has(timestamp));
    if (pruned.length !== this.telemetryNavigatorPinnedTimestamps.length) {
      this.telemetryNavigatorPinnedTimestamps = pruned;
      this.persistPinnedTelemetryTimestamps();
    }

    this.enforceTelemetryNavigatorPinQuota();
  }

  private enforceTelemetryNavigatorPinQuota(): void {
    if (this.telemetryNavigatorPinnedTimestamps.length <= this.telemetryNavigatorMaxPins) {
      return;
    }

    this.telemetryNavigatorPinnedTimestamps = this.telemetryNavigatorPinnedTimestamps.slice(0, this.telemetryNavigatorMaxPins);
    this.persistPinnedTelemetryTimestamps();
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
    this.prunePinnedTelemetryTimestamps();
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
      this.telemetryNavigatorOffset = 0;
      this.telemetryNavigatorContinuousMode = false;
      this.telemetryNavigatorSortOrder = 'newest';
      this.telemetryNavigatorMinRate = 0;
      this.telemetryNavigatorPinnedOnlyMode = false;
      this.telemetryNavigatorActivePreset = 'custom';
      this.syncActiveTelemetryPoint();
      this.clampTelemetryNavigatorOffset();
      this.persistTelemetryNavigatorPreferences();
    }
  }

  setTelemetryZoom(zoom: number): void {
    if (zoom === 1 || zoom === 2 || zoom === 4) {
      this.telemetryZoomLevel = zoom;
      this.clampTelemetryPanOffset();
      this.syncActiveTelemetryPoint();
      this.clampTelemetryNavigatorOffset();
    }
  }

  toggleTelemetryNavigatorContinuousMode(): void {
    this.telemetryNavigatorContinuousMode = !this.telemetryNavigatorContinuousMode;
    if (this.telemetryNavigatorContinuousMode) {
      this.telemetryNavigatorOffset = 0;
    }
    this.clampTelemetryNavigatorOffset();
    this.telemetryNavigatorActivePreset = 'custom';
    this.persistTelemetryNavigatorPreferences();
  }

  toggleTelemetryNavigatorSortOrder(): void {
    this.telemetryNavigatorSortOrder = this.telemetryNavigatorSortOrder === 'newest' ? 'oldest' : 'newest';
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.telemetryNavigatorActivePreset = 'custom';
    this.persistTelemetryNavigatorPreferences();
  }

  resetTelemetryNavigatorPreferences(): void {
    this.telemetryNavigatorContinuousMode = false;
    this.telemetryNavigatorSortOrder = 'newest';
    this.telemetryNavigatorPageSize = 8;
    this.telemetryNavigatorMinRate = 0;
    this.telemetryNavigatorPinnedOnlyMode = false;
    this.telemetryNavigatorActivePreset = 'custom';
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.persistTelemetryNavigatorPreferences();
  }

  applyTelemetryNavigatorPreset(preset: 'focus' | 'explore'): void {
    if (preset === 'focus') {
      this.telemetryNavigatorContinuousMode = false;
      this.telemetryNavigatorSortOrder = 'newest';
      this.telemetryNavigatorPageSize = 5;
      this.telemetryNavigatorMinRate = 60;
      this.telemetryNavigatorPinnedOnlyMode = false;
      this.telemetryNavigatorActivePreset = 'focus';
    } else {
      this.telemetryNavigatorContinuousMode = true;
      this.telemetryNavigatorSortOrder = 'oldest';
      this.telemetryNavigatorPageSize = 15;
      this.telemetryNavigatorMinRate = 0;
      this.telemetryNavigatorPinnedOnlyMode = false;
      this.telemetryNavigatorActivePreset = 'explore';
    }

    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.persistTelemetryNavigatorPreferences();
  }

  setTelemetryNavigatorMinRate(rate: number | string): void {
    const parsed = typeof rate === 'string' ? parseFloat(rate) : rate;
    this.telemetryNavigatorMinRate = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.telemetryNavigatorActivePreset = 'custom';
    this.persistTelemetryNavigatorPreferences();
  }

  setTelemetryNavigatorPageSize(size: number | string): void {
    const parsed = typeof size === 'string' ? parseInt(size, 10) : size;
    if (!this.telemetryNavigatorPageSizeOptions.includes(parsed)) {
      return;
    }

    this.telemetryNavigatorPageSize = parsed;
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.telemetryNavigatorActivePreset = 'custom';
    this.persistTelemetryNavigatorPreferences();
  }

  isTelemetryNavigatorPinned(point: AdoptionTelemetryPoint): boolean {
    return this.telemetryNavigatorPinnedTimestamps.includes(point.timestamp);
  }

  toggleTelemetryNavigatorPin(point: AdoptionTelemetryPoint): void {
    if (this.isTelemetryNavigatorPinned(point)) {
      this.telemetryNavigatorPinnedTimestamps = this.telemetryNavigatorPinnedTimestamps.filter(
        (timestamp) => timestamp !== point.timestamp
      );
      this.telemetryNavigatorPinLimitMessage = '';
    } else {
      const added = this.tryAddTelemetryNavigatorPin(point.timestamp);
      if (!added) {
        this.telemetryNavigatorPinLimitMessage = `Pin limit reached (${this.telemetryNavigatorMaxPins}). Unpin snapshots to add more.`;
      }
    }

    if (!this.telemetryNavigatorPinnedTimestamps.length) {
      this.telemetryNavigatorPinnedOnlyMode = false;
    }

    this.persistPinnedTelemetryTimestamps();
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.persistTelemetryNavigatorPreferences();
  }

  canPinVisibleTelemetryNavigatorPoints(): boolean {
    if (this.telemetryNavigatorContinuousMode) {
      return false;
    }

    if (this.telemetryNavigatorPinnedTimestamps.length >= this.telemetryNavigatorMaxPins) {
      return false;
    }

    return this.getTelemetryNavigatorPoints().some((point) => !this.isTelemetryNavigatorPinned(point));
  }

  pinVisibleTelemetryNavigatorPoints(): void {
    if (this.telemetryNavigatorContinuousMode) {
      this.telemetryNavigatorPinLimitMessage = 'Bulk pinning is disabled while continuous mode is on.';
      return;
    }

    if (!this.getTelemetryNavigatorPoints().length) {
      return;
    }

    const visibleUnpinned = this.getTelemetryNavigatorPoints().filter((point) => !this.isTelemetryNavigatorPinned(point));
    if (!visibleUnpinned.length) {
      return;
    }

    let added = 0;
    for (const point of visibleUnpinned) {
      if (this.tryAddTelemetryNavigatorPin(point.timestamp)) {
        added++;
      } else {
        break;
      }
    }

    if (!added) {
      this.telemetryNavigatorPinLimitMessage = `Pin limit reached (${this.telemetryNavigatorMaxPins}). Unpin snapshots to add more.`;
      return;
    }

    if (added < visibleUnpinned.length) {
      this.telemetryNavigatorPinLimitMessage = `Pinned ${added} of ${visibleUnpinned.length} visible snapshots (limit ${this.telemetryNavigatorMaxPins}).`;
    } else {
      this.telemetryNavigatorPinLimitMessage = '';
    }

    this.persistPinnedTelemetryTimestamps();
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
  }

  clearTelemetryNavigatorPins(): void {
    if (!this.telemetryNavigatorPinnedTimestamps.length) {
      return;
    }

    this.telemetryNavigatorPinnedTimestamps = [];
    this.telemetryNavigatorPinnedOnlyMode = false;
    this.telemetryNavigatorPinLimitMessage = '';
    this.persistPinnedTelemetryTimestamps();
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.persistTelemetryNavigatorPreferences();
  }

  toggleTelemetryNavigatorPinnedOnlyMode(): void {
    if (!this.telemetryNavigatorPinnedTimestamps.length && !this.telemetryNavigatorPinnedOnlyMode) {
      return;
    }

    this.telemetryNavigatorPinnedOnlyMode = !this.telemetryNavigatorPinnedOnlyMode;
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.telemetryNavigatorActivePreset = 'custom';
    this.persistTelemetryNavigatorPreferences();
  }

  getTelemetryNavigatorPresetLabel(): string {
    if (this.telemetryNavigatorActivePreset === 'focus') {
      return 'Focus';
    }

    if (this.telemetryNavigatorActivePreset === 'explore') {
      return 'Explore';
    }

    return 'Custom';
  }

  getPinnedTelemetryNavigatorPoints(): AdoptionTelemetryPoint[] {
    const pointsByTimestamp = new Map(this.adoptionTelemetry.map((point) => [point.timestamp, point]));
    const points = this.telemetryNavigatorPinnedTimestamps
      .map((timestamp) => pointsByTimestamp.get(timestamp))
      .filter((point): point is AdoptionTelemetryPoint => !!point);

    return this.telemetryNavigatorSortOrder === 'newest'
      ? [...points].sort((left, right) => right.timestamp - left.timestamp)
      : [...points].sort((left, right) => left.timestamp - right.timestamp);
  }

  jumpToPinnedTelemetrySnapshot(timestamp: number): void {
    const point = this.adoptionTelemetry.find((candidate) => candidate.timestamp === timestamp);
    if (!point) {
      return;
    }

    this.focusTelemetryPoint(point);
  }

  getPinnedSnapshotAgeLabel(timestamp: number): string {
    if (!this.adoptionTelemetry.length) {
      return 'Age --';
    }

    const latestTimestamp = this.adoptionTelemetry[this.adoptionTelemetry.length - 1].timestamp;
    const diffMinutes = Math.max(0, Math.round((latestTimestamp - timestamp) / (60 * 1000)));
    if (diffMinutes < 60) {
      return `Age ${diffMinutes}m`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) {
      return `Age ${diffHours}h`;
    }

    const diffDays = Math.round(diffHours / 24);
    return `Age ${diffDays}d`;
  }

  getPinnedSnapshotContextLabel(point: AdoptionTelemetryPoint): string {
    if (!this.adoptionTelemetry.length) {
      return 'outside window';
    }

    const range = this.getTelemetryViewRange();
    return point.timestamp >= range.start && point.timestamp <= range.end ? 'within window' : 'outside window';
  }

  unpinTelemetryNavigatorTimestamp(timestamp: number): void {
    if (!this.telemetryNavigatorPinnedTimestamps.includes(timestamp)) {
      return;
    }

    this.telemetryNavigatorPinnedTimestamps = this.telemetryNavigatorPinnedTimestamps.filter(
      (candidate) => candidate !== timestamp
    );
    if (!this.telemetryNavigatorPinnedTimestamps.length) {
      this.telemetryNavigatorPinnedOnlyMode = false;
    }
    this.telemetryNavigatorPinLimitMessage = '';
    this.persistPinnedTelemetryTimestamps();
    this.telemetryNavigatorOffset = 0;
    this.clampTelemetryNavigatorOffset();
    this.persistTelemetryNavigatorPreferences();
  }

  private tryAddTelemetryNavigatorPin(timestamp: number): boolean {
    if (this.telemetryNavigatorPinnedTimestamps.includes(timestamp)) {
      return true;
    }

    if (this.telemetryNavigatorPinnedTimestamps.length >= this.telemetryNavigatorMaxPins) {
      return false;
    }

    this.telemetryNavigatorPinnedTimestamps = [...this.telemetryNavigatorPinnedTimestamps, timestamp];
    return true;
  }

  panTelemetryWindow(direction: 'older' | 'newer'): void {
    const nextOffset = direction === 'older'
      ? this.telemetryPanOffsetSteps + 1
      : this.telemetryPanOffsetSteps - 1;

    this.telemetryPanOffsetSteps = Math.max(0, Math.min(this.getMaxTelemetryPanOffsetSteps(), nextOffset));
    this.syncActiveTelemetryPoint();
    this.clampTelemetryNavigatorOffset();
  }

  exportTelemetryWindowCsv(): void {
    const points = this.getTelemetryWindowPoints();
    if (!points.length) {
      return;
    }

    const headers = ['timestamp_iso', 'timestamp_ms', 'adoption_rate', 'completed_count', 'in_progress_count', 'open_count'];
    const rows = points.map((point) => [
      new Date(point.timestamp).toISOString(),
      point.timestamp,
      point.adoptionRate,
      point.completedCount,
      point.inProgressCount,
      point.openCount,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => this.escapeTelemetryCsvValue(String(value))).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `telemetry-window-${this.selectedTelemetryWindow}-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  toggleTelemetryShortcutHelp(): void {
    this.telemetryShortcutHelpOpen = !this.telemetryShortcutHelpOpen;
  }

  @HostListener('window:keydown', ['$event'])
  handleTelemetryKeyboardShortcut(event: KeyboardEvent): void {
    if (this.shouldIgnoreTelemetryShortcutEvent(event)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (key === '?' || (event.key === '/' && event.shiftKey)) {
      this.toggleTelemetryShortcutHelp();
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape' && this.telemetryShortcutHelpOpen) {
      this.telemetryShortcutHelpOpen = false;
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowLeft' && this.canPanTelemetryOlder()) {
      this.panTelemetryWindow('older');
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowRight' && this.canPanTelemetryNewer()) {
      this.panTelemetryWindow('newer');
      event.preventDefault();
      return;
    }

    if (key === 'j' && this.canShiftTelemetryNavigatorOlder()) {
      this.shiftTelemetryNavigator('older');
      event.preventDefault();
      return;
    }

    if (key === 'k' && this.canShiftTelemetryNavigatorNewer()) {
      this.shiftTelemetryNavigator('newer');
      event.preventDefault();
      return;
    }

    if (key === 'l' && this.canRecenterTelemetryToLiveEdge()) {
      this.recenterTelemetryToLiveEdge();
      event.preventDefault();
    }
  }

  canPanTelemetryOlder(): boolean {
    return this.telemetryPanOffsetSteps < this.getMaxTelemetryPanOffsetSteps();
  }

  canPanTelemetryNewer(): boolean {
    return this.telemetryPanOffsetSteps > 0;
  }

  recenterTelemetryToLiveEdge(): void {
    this.telemetryPanOffsetSteps = 0;
    this.telemetryNavigatorOffset = 0;
    this.syncActiveTelemetryPoint();
    this.clampTelemetryNavigatorOffset();
  }

  canRecenterTelemetryToLiveEdge(): boolean {
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

  getTelemetryNavigatorPoints(): AdoptionTelemetryPoint[] {
    const points = this.getAllTelemetryNavigatorPoints();
    if (this.telemetryNavigatorContinuousMode) {
      return points;
    }

    return points.slice(this.telemetryNavigatorOffset, this.telemetryNavigatorOffset + this.telemetryNavigatorPageSize);
  }

  shiftTelemetryNavigator(direction: 'older' | 'newer'): void {
    if (this.telemetryNavigatorContinuousMode) {
      return;
    }

    const stepDirection = this.telemetryNavigatorSortOrder === 'newest'
      ? (direction === 'older' ? 1 : -1)
      : (direction === 'older' ? -1 : 1);
    const step = stepDirection * this.telemetryNavigatorPageSize;
    this.telemetryNavigatorOffset = Math.max(
      0,
      Math.min(this.getMaxTelemetryNavigatorOffset(), this.telemetryNavigatorOffset + step)
    );
  }

  canShiftTelemetryNavigatorOlder(): boolean {
    if (this.telemetryNavigatorContinuousMode) {
      return false;
    }

    return this.telemetryNavigatorSortOrder === 'newest'
      ? this.telemetryNavigatorOffset < this.getMaxTelemetryNavigatorOffset()
      : this.telemetryNavigatorOffset > 0;
  }

  canShiftTelemetryNavigatorNewer(): boolean {
    if (this.telemetryNavigatorContinuousMode) {
      return false;
    }

    return this.telemetryNavigatorSortOrder === 'newest'
      ? this.telemetryNavigatorOffset > 0
      : this.telemetryNavigatorOffset < this.getMaxTelemetryNavigatorOffset();
  }

  private getAllTelemetryNavigatorPoints(): AdoptionTelemetryPoint[] {
    const visibleTimestamps = new Set(this.getTelemetryWindowPoints().map((point) => point.timestamp));
    const pinnedTimestamps = new Set(this.telemetryNavigatorPinnedTimestamps);
    const pinnedPoints = this.adoptionTelemetry.filter((point) => pinnedTimestamps.has(point.timestamp));
    const orderedPinned = this.telemetryNavigatorSortOrder === 'newest'
      ? [...pinnedPoints].sort((left, right) => right.timestamp - left.timestamp)
      : [...pinnedPoints].sort((left, right) => left.timestamp - right.timestamp);

    if (this.telemetryNavigatorPinnedOnlyMode) {
      return orderedPinned;
    }

    const points = this.adoptionTelemetry.filter(
      (point) => !pinnedTimestamps.has(point.timestamp)
        && !visibleTimestamps.has(point.timestamp)
        && point.adoptionRate >= this.telemetryNavigatorMinRate
    );
    const orderedPoints = this.telemetryNavigatorSortOrder === 'newest' ? [...points].reverse() : points;
    return [...orderedPinned, ...orderedPoints];
  }

  private getMaxTelemetryNavigatorOffset(): number {
    const total = this.getAllTelemetryNavigatorPoints().length;
    return Math.max(0, total - this.telemetryNavigatorPageSize);
  }

  private clampTelemetryNavigatorOffset(): void {
    this.telemetryNavigatorOffset = Math.max(0, Math.min(this.telemetryNavigatorOffset, this.getMaxTelemetryNavigatorOffset()));
  }

  private escapeTelemetryCsvValue(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  private shouldIgnoreTelemetryShortcutEvent(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return true;
    }

    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }

    const tagName = target.tagName;
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
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

  getTelemetryNavigatorDelta(point: AdoptionTelemetryPoint): number {
    const index = this.adoptionTelemetry.findIndex((candidate) => candidate.timestamp === point.timestamp);
    if (index <= 0) {
      return 0;
    }

    const previous = this.adoptionTelemetry[index - 1];
    return point.adoptionRate - previous.adoptionRate;
  }

  formatTelemetryNavigatorDelta(point: AdoptionTelemetryPoint): string {
    const delta = this.getTelemetryNavigatorDelta(point);
    return `${delta > 0 ? '+' : ''}${delta}%`;
  }

  getTelemetryNavigatorDeltaColor(point: AdoptionTelemetryPoint): string {
    const delta = this.getTelemetryNavigatorDelta(point);
    if (delta > 0) {
      return 'var(--ri-success)';
    }

    if (delta < 0) {
      return 'var(--ri-error)';
    }

    return 'var(--ri-on-surface-variant)';
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

  selectTelemetryTimelinePoint(point: AdoptionTelemetryPoint): void {
    this.setHoveredTelemetryPoint(point);
  }

  focusTelemetryPoint(point: AdoptionTelemetryPoint): void {
    if (!this.adoptionTelemetry.length) {
      return;
    }

    const latestTimestamp = this.adoptionTelemetry[this.adoptionTelemetry.length - 1].timestamp;
    const estimatedOffset = Math.round((latestTimestamp - point.timestamp) / this.getTelemetryPanStepMs());
    this.telemetryPanOffsetSteps = Math.max(0, Math.min(this.getMaxTelemetryPanOffsetSteps(), estimatedOffset));
    this.syncActiveTelemetryPoint();
    this.clampTelemetryNavigatorOffset();
    this.setHoveredTelemetryPoint(point);
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
