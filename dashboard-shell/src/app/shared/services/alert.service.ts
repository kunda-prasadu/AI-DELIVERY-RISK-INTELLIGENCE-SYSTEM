import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface AlertBreach {
  rule: 'CRITICAL_EVENT_COUNT' | 'RISK_SCORE' | 'TREND_WORSENING';
  message: string;
  actual: number;
  threshold: number;
}

export interface ProjectAlert {
  projectId: string;
  active: boolean;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  breachCount: number;
  breaches: AlertBreach[];
  evaluatedAt: string;
}

export interface PortfolioAlerts {
  totalActive: number;
  alerts: ProjectAlert[];
}

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly METRICS_BASE = '/api/metrics';

  constructor(private http: HttpClient) {}

  getPortfolioAlerts(): Observable<PortfolioAlerts> {
    return this.http
      .get<PortfolioAlerts>(`${this.METRICS_BASE}/alerts`)
      .pipe(catchError(() => of({ totalActive: 0, alerts: [] })));
  }

  getProjectAlerts(projectId: string): Observable<ProjectAlert | null> {
    return this.http
      .get<ProjectAlert>(`${this.METRICS_BASE}/projects/${projectId}/alerts`)
      .pipe(catchError(() => of(null)));
  }

  getActiveAlertCount(): Observable<number> {
    return this.getPortfolioAlerts().pipe(map((r) => r.totalActive));
  }
}
