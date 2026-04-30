import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SloMetricSummary {
  count: number;
  minMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  withinTarget: boolean;
}

export interface ApiSloSummary {
  targetP95Ms: number;
  overall: SloMetricSummary | null;
  byEndpoint: Array<SloMetricSummary & { method: string; path: string }>;
}

export interface DashboardSloSummary {
  targetP95Ms: number;
  overall: SloMetricSummary | null;
  byRoute: Array<SloMetricSummary & { route: string }>;
}

export interface PerformanceSloSummary {
  generatedAt: string;
  api: ApiSloSummary;
  dashboard: DashboardSloSummary;
  overall: {
    apiWithinTarget: boolean | null;
    dashboardWithinTarget: boolean | null;
  };
}

@Injectable({ providedIn: 'root' })
export class PerformanceService {
  private readonly BASE = '/api/observability/metrics';

  constructor(private http: HttpClient) {}

  getSloSummary(): Observable<PerformanceSloSummary> {
    return this.http.get<PerformanceSloSummary>(`${this.BASE}/slo`);
  }

  recordDashboardRender(route: string, durationMs: number): Observable<{ accepted: boolean }> {
    return this.http.post<{ accepted: boolean }>(`${this.BASE}/frontend`, { route, durationMs });
  }
}