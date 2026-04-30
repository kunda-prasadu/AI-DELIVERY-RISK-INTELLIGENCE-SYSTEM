import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, catchError, finalize, of } from 'rxjs';
import { AuthService } from '../../shared/services/auth.service';
import { PerformanceService, PerformanceSloSummary } from '../../shared/services/performance.service';

@Component({
  selector: 'app-performance-optimization',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Performance and Scale</h1>
      <p class="subtitle">Track API and dashboard p95 latency against release SLO targets.</p>

      <mat-card *ngIf="!canView" class="state-card error">
        <mat-card-content>
          <p>Access denied. Administrator access is required.</p>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="canView" class="toolbar-card">
        <mat-card-content class="toolbar-content">
          <p class="summary" *ngIf="summary && !loading && !errorMessage">
            API p95 target {{ summary.api.targetP95Ms }} ms. Dashboard p95 target {{ summary.dashboard.targetP95Ms }} ms.
          </p>
          <button mat-stroked-button type="button" (click)="loadSummary()" [disabled]="loading">Refresh</button>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="canView && loading" class="state-card">
        <mat-card-content class="state-content">
          <mat-spinner diameter="32"></mat-spinner>
          <p>Loading performance telemetry...</p>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="canView && !loading && errorMessage" class="state-card error">
        <mat-card-content class="state-content">
          <p>{{ errorMessage }}</p>
        </mat-card-content>
      </mat-card>

      <div class="summary-grid" *ngIf="canView && !loading && !errorMessage && summary">
        <mat-card>
          <mat-card-header>
            <mat-card-title>API p95</mat-card-title>
            <mat-card-subtitle>{{ summary.api.overall?.withinTarget ? 'Within target' : 'Attention required' }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="metric">{{ summary.api.overall?.p95Ms ?? 0 }} ms</p>
            <p class="supporting">Requests: {{ summary.api.overall?.count ?? 0 }}</p>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Dashboard p95</mat-card-title>
            <mat-card-subtitle>{{ summary.dashboard.overall?.withinTarget ? 'Within target' : 'Attention required' }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="metric">{{ summary.dashboard.overall?.p95Ms ?? 0 }} ms</p>
            <p class="supporting">Samples: {{ summary.dashboard.overall?.count ?? 0 }}</p>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="details-grid" *ngIf="canView && !loading && !errorMessage && summary">
        <mat-card>
          <mat-card-header>
            <mat-card-title>Worst API Endpoints</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="detail-row" *ngFor="let item of summary.api.byEndpoint.slice(0, 5)">
              <span>{{ item.method }} {{ item.path }}</span>
              <span>{{ item.p95Ms }} ms</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card>
          <mat-card-header>
            <mat-card-title>Worst Dashboard Routes</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="detail-row" *ngFor="let item of summary.dashboard.byRoute.slice(0, 5)">
              <span>{{ item.route }}</span>
              <span>{{ item.p95Ms }} ms</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1400px; }
    .subtitle { color: var(--ri-on-surface-variant); margin: 0 0 24px; font-size: 14px; }
    .toolbar-card, .state-card, .summary-grid mat-card, .details-grid mat-card { margin-bottom: 16px; }
    .toolbar-content, .state-content, .detail-row { display: flex; align-items: center; gap: 12px; }
    .toolbar-content { justify-content: space-between; }
    .summary-grid, .details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .metric { font-size: 28px; font-weight: 700; margin: 0; }
    .supporting, .summary { margin: 0; color: var(--ri-on-surface-variant); }
    .detail-row { justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--ri-outline-variant); }
    .detail-row:last-child { border-bottom: none; }
    .error p { color: #ba1a1a; }
  `],
})
export class PerformanceOptimizationComponent implements OnInit, OnDestroy {
  canView = false;
  loading = false;
  errorMessage = '';
  summary: PerformanceSloSummary | null = null;
  private userSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private performanceService: PerformanceService,
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(() => {
      this.canView = this.authService.hasRole('admin');
      if (this.canView && !this.summary && !this.loading) {
        this.loadSummary();
      }
      if (!this.canView) {
        this.summary = null;
        this.errorMessage = '';
      }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  loadSummary(): void {
    this.loading = true;
    this.errorMessage = '';

    this.performanceService.getSloSummary()
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load performance telemetry.';
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        }),
      )
      .subscribe((summary) => {
        this.summary = summary;
      });
  }
}