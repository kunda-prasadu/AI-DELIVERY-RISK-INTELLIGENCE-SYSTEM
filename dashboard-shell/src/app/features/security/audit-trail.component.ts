import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize, of } from 'rxjs';
import { Subscription } from 'rxjs';
import { AuditEntry, AuditIntegrity, AuditService } from '../../shared/services/audit.service';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-audit-trail',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Audit Trail</h1>
      <p class="subtitle">Tamper-evident security and access events for administrators.</p>

      <mat-card class="toolbar-card" *ngIf="canReadAudit">
        <mat-card-content>
          <div class="toolbar-content">
            <p class="summary" *ngIf="!loading && !errorMessage">
              Showing {{ entries.length }} audit events. Integrity: {{ integrity?.valid ? 'verified' : 'attention required' }}.
            </p>
            <button mat-stroked-button type="button" (click)="loadAuditTrail()" [disabled]="loading">Refresh</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="!canReadAudit" class="state-card error">
        <mat-card-content>
          <div class="state-content">
            <p>Access denied. Administrator audit permissions are required.</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="canReadAudit && loading" class="state-card">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading audit events...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="canReadAudit && !loading && errorMessage" class="state-card error">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadAuditTrail()">Try Again</button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="canReadAudit && !loading && !errorMessage && integrity" class="state-card">
        <mat-card-content>
          <div class="integrity-row">
            <div class="integrity-chip" [class.valid]="integrity.valid" [class.invalid]="!integrity.valid">
              {{ integrity.valid ? 'Integrity Verified' : 'Integrity Broken' }}
            </div>
            <span class="meta">Entries: {{ integrity.totalEntries }}</span>
            <span class="meta" *ngIf="integrity.lastHash">Last hash: {{ integrity.lastHash.slice(0, 12) }}...</span>
            <span class="meta" *ngIf="integrity.brokenAt">Broken at: {{ integrity.brokenAt }}</span>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="events-grid" *ngIf="canReadAudit && !loading && !errorMessage && entries.length">
        <mat-card class="event-card" *ngFor="let entry of entries">
          <mat-card-header>
            <mat-card-title>{{ entry.action }}</mat-card-title>
            <mat-card-subtitle>{{ entry.timestamp | date:'medium' }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="meta-row">
              <span class="chip" [class.success]="entry.outcome === 'SUCCESS'" [class.failure]="entry.outcome !== 'SUCCESS'">{{ entry.outcome }}</span>
              <span class="meta">Role: {{ entry.actorRole || 'anonymous' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta">Actor: {{ entry.actorId || 'n/a' }}</span>
              <span class="meta">Resource: {{ entry.resourceType }}{{ entry.resourceId ? (' · ' + entry.resourceId) : '' }}</span>
            </div>
            <p class="hash-copy">Hash: {{ entry.hash.slice(0, 20) }}...</p>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card *ngIf="canReadAudit && !loading && !errorMessage && !entries.length" class="state-card">
        <mat-card-content>
          <div class="state-content">
            <p>No audit events recorded yet.</p>
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

    .toolbar-card,
    .state-card,
    .event-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .toolbar-content,
    .integrity-row,
    .meta-row,
    .state-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .toolbar-content { justify-content: space-between; }
    .summary, .meta, .hash-copy { margin: 0; color: var(--ri-on-surface-variant); font-size: 12px; }
    .events-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
    .integrity-chip, .chip {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }
    .integrity-chip.valid, .chip.success { background: #e8f5e9; color: #2e7d32; }
    .integrity-chip.invalid, .chip.failure { background: #ffebee; color: #ba1a1a; }
    .state-card.error p { color: #ba1a1a; margin: 0; }
  `],
})
export class AuditTrailComponent implements OnInit, OnDestroy {
  entries: AuditEntry[] = [];
  integrity: AuditIntegrity | null = null;
  loading = false;
  errorMessage = '';
  canReadAudit = false;
  private userSubscription: Subscription | null = null;

  constructor(
    private auditService: AuditService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userSubscription = this.authService.user$.subscribe(() => {
      const nextCanReadAudit = this.authService.hasPermission('audit:read');
      const permissionJustGranted = !this.canReadAudit && nextCanReadAudit;
      this.canReadAudit = nextCanReadAudit;

      if (!this.canReadAudit) {
        this.entries = [];
        this.integrity = null;
        return;
      }

      if (permissionJustGranted || (!this.entries.length && !this.loading && !this.errorMessage)) {
        this.loadAuditTrail();
      }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
  }

  loadAuditTrail(): void {
    this.loading = true;
    this.errorMessage = '';

    this.auditService
      .list({ limit: 20 })
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load audit events. Verify identity service health and admin access.';
          return of({ entries: [], total: 0, integrity: null } as any);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((response) => {
        this.entries = response.entries;
        this.integrity = response.integrity;
      });
  }
}
