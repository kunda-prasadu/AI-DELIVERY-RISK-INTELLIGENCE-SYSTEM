import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { ProjectItem, ProjectsService } from '../../shared/services/projects.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <div class="page-container">
      <h1 class="text-display-lg">Active Projects</h1>
      <p class="subtitle">Real-time supervision of active delivery tracks. Monitor cross-functional health metrics and risk distribution.</p>

      <mat-card class="toolbar-card">
        <mat-card-content>
          <div class="toolbar-content">
            <p class="summary" *ngIf="!loading && !errorMessage">
              Showing {{ projects.length }} projects from live gateway data.
            </p>
            <button mat-stroked-button type="button" (click)="loadProjects()" [disabled]="loading">
              Refresh
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="loading" class="state-card">
        <mat-card-content>
          <div class="state-content">
            <mat-spinner diameter="32"></mat-spinner>
            <p>Loading projects from gateway...</p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card *ngIf="!loading && errorMessage" class="state-card error">
        <mat-card-content>
          <div class="state-content">
            <p>{{ errorMessage }}</p>
            <button mat-flat-button type="button" (click)="loadProjects()">Try Again</button>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="projects-grid" *ngIf="!loading && !errorMessage && projects.length">
        <mat-card class="project-card" *ngFor="let project of projects">
          <mat-card-header>
            <mat-card-title>{{ project.name }}</mat-card-title>
            <mat-card-subtitle>{{ project.id }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="description">{{ project.description }}</p>
            <div class="meta-row">
              <span class="chip" [class]="'status-' + project.status">{{ project.status }}</span>
              <span class="meta">Team: {{ project.team }}</span>
            </div>
            <div class="meta-row">
              <span class="meta">Start: {{ project.startDate || 'n/a' }}</span>
              <span class="meta">Target: {{ project.targetDate || 'n/a' }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <mat-card *ngIf="!loading && !errorMessage && !projects.length" class="state-card">
        <mat-card-content>
          <div class="state-content">
            <p>No projects were returned by the gateway.</p>
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
    .project-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .toolbar-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .summary {
      margin: 0;
      color: var(--ri-on-surface-variant);
      font-size: 14px;
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

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
    }

    .description {
      margin: 0 0 12px 0;
      color: var(--ri-on-surface-variant);
      font-size: 14px;
      line-height: 1.4;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .meta {
      color: var(--ri-on-surface-variant);
      font-size: 12px;
      font-weight: 500;
    }

    .chip {
      padding: 3px 10px;
      border-radius: 999px;
      text-transform: capitalize;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
    }

    .status-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-at_risk {
      background: #ffebee;
      color: #ba1a1a;
    }

    .status-paused {
      background: #fff8e1;
      color: #f9a825;
    }

    .status-completed {
      background: #e3f2fd;
      color: #1565c0;
    }
  `],
})
export class ProjectsComponent implements OnInit {
  projects: ProjectItem[] = [];
  loading = false;
  errorMessage = '';

  constructor(private projectsService: ProjectsService) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading = true;
    this.errorMessage = '';

    this.projectsService
      .getProjects({ status: 'active' })
      .pipe(
        catchError(() => {
          this.errorMessage = 'Unable to load projects from gateway. Check service health and authentication.';
          return of({ projects: [], total: 0 });
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe(response => {
        this.projects = response.projects;
      });
  }
}
