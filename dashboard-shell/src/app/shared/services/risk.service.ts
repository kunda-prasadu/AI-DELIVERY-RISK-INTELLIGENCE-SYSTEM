import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

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
  // In production, this fetches from /projects/:id/risk-score
  private riskScores$ = new BehaviorSubject<RiskScore[]>([
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
  ]);

  constructor() {}

  getRiskScores(): Observable<RiskScore[]> {
    return this.riskScores$.asObservable();
  }

  getRiskScore(projectId: string): Observable<RiskScore | undefined> {
    return new Observable(observer => {
      this.riskScores$.subscribe(scores => {
        observer.next(scores.find(s => s.projectId === projectId));
      });
    });
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
