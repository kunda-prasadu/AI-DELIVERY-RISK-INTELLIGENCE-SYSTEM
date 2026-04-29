import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';

export interface RiskScore {
  projectId: string;
  projectName: string;
  score: number; // 0-100
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  signals: {
    codeVelocity: number;
    quality: number;
    cicd: number;
    jiraVelocity: number;
  };
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root',
})
export class RiskService {
  private readonly PROJECTS_BASE = '/api/projects';
  private hasAttemptedLoad = false;
  private loading = false;

  private readonly fallbackRiskScores: RiskScore[] = [
    {
      projectId: 'proj-payments',
      projectName: 'Payments Gateway',
      score: 72,
      band: 'HIGH',
      signals: { codeVelocity: 70, quality: 65, cicd: 80, jiraVelocity: 75 },
      lastUpdated: new Date().toISOString(),
    },
    {
      projectId: 'proj-iam',
      projectName: 'IAM Platform',
      score: 45,
      band: 'MEDIUM',
      signals: { codeVelocity: 50, quality: 40, cicd: 45, jiraVelocity: 43 },
      lastUpdated: new Date().toISOString(),
    },
    {
      projectId: 'proj-data',
      projectName: 'Data Platform',
      score: 28,
      band: 'LOW',
      signals: { codeVelocity: 30, quality: 25, cicd: 28, jiraVelocity: 30 },
      lastUpdated: new Date().toISOString(),
    },
    {
      projectId: 'proj-mobile',
      projectName: 'Mobile App',
      score: 85,
      band: 'CRITICAL',
      signals: { codeVelocity: 90, quality: 80, cicd: 85, jiraVelocity: 83 },
      lastUpdated: new Date().toISOString(),
    },
    {
      projectId: 'proj-ai-risk',
      projectName: 'AI Delivery Risk',
      score: 35,
      band: 'LOW',
      signals: { codeVelocity: 40, quality: 32, cicd: 35, jiraVelocity: 33 },
      lastUpdated: new Date().toISOString(),
    },
  ];

  private riskScores$ = new BehaviorSubject<RiskScore[]>([]);

  constructor(private http: HttpClient) {}

  getRiskScores(): Observable<RiskScore[]> {
    if (!this.hasAttemptedLoad) {
      this.refreshRiskScores().subscribe();
    }
    return this.riskScores$.asObservable();
  }

  getRiskScore(projectId: string): Observable<RiskScore | undefined> {
    return this.getRiskScores().pipe(map(scores => scores.find(s => s.projectId === projectId)));
  }

  refreshRiskScores(): Observable<RiskScore[]> {
    if (this.loading) {
      return this.riskScores$.asObservable();
    }

    this.hasAttemptedLoad = true;
    this.loading = true;

    return this.http.get<{ projects: Array<{ id: string; name: string }> }>(this.PROJECTS_BASE).pipe(
      map(response => response.projects || []),
      map(projects => projects.slice(0, 25)),
      switchMap(projects => {
        if (!projects.length) {
          return of([] as RiskScore[]);
        }

        const requests = projects.map(project =>
          this.http
            .get<{ riskScore: { score: number; band: RiskScore['band']; signals: RiskScore['signals']; computedAt?: string } }>(
              `${this.PROJECTS_BASE}/${project.id}/risk-score`
            )
            .pipe(
              map(result => ({
                projectId: project.id,
                projectName: project.name,
                score: result.riskScore.score,
                band: result.riskScore.band,
                signals: result.riskScore.signals,
                lastUpdated: result.riskScore.computedAt || new Date().toISOString(),
              }))
            )
        );

        return forkJoin(requests);
      }),
      tap(scores => this.riskScores$.next(scores)),
      catchError(() => {
        this.riskScores$.next(this.fallbackRiskScores);
        return of(this.fallbackRiskScores);
      }),
      finalize(() => {
        this.loading = false;
      })
    );
  }

  /**
   * Get color for risk band.
   * Maps Material Design 3 semantic colors.
   */
  getBandColor(band: string): string {
    const colors: { [key: string]: string } = {
      LOW: '#2e7d32',       // Emerald (success)
      MEDIUM: '#f9a825',    // Amber (warning)
      HIGH: '#f57c00',      // Orange (high warning)
      CRITICAL: '#ba1a1a',  // Rose (error/critical)
    };
    return colors[band] || '#565e74'; // Slate default
  }

  /**
   * Get background color for risk band (lighter shade).
   */
  getBandBackgroundColor(band: string): string {
    const colors: { [key: string]: string } = {
      LOW: '#e8f5e9',       // Light emerald
      MEDIUM: '#fff8e1',    // Light amber
      HIGH: '#ffe8cc',      // Light orange
      CRITICAL: '#ffebee',  // Light rose
    };
    return colors[band] || '#f0ecf9'; // Light slate default
  }
}
