import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InsightItem {
  id: string;
  domain: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  detail: string;
  action: string;
}

interface InsightsResponse {
  projectId: string;
  riskScore: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  insights: InsightItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  generatedAt: string;
}

export interface InsightSummary {
  projectId: string;
  riskScore: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  totalInsights: number;
  severityCounts: {
    INFO: number;
    WARNING: number;
    CRITICAL: number;
  };
  domainCounts: Record<string, number>;
  generatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class InsightsService {
  private readonly PROJECTS_BASE = '/api/projects';

  constructor(private http: HttpClient) {}

  getProjectInsights(
    projectId: string,
    filters?: { severity?: 'INFO' | 'WARNING' | 'CRITICAL'; domain?: string; page?: number; limit?: number }
  ): Observable<InsightsResponse> {
    let params = new HttpParams();

    if (filters?.severity) {
      params = params.set('severity', filters.severity);
    }

    if (filters?.domain) {
      params = params.set('domain', filters.domain);
    }

    if (filters?.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters?.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.http.get<InsightsResponse>(`${this.PROJECTS_BASE}/${projectId}/insights`, { params });
  }

  getProjectInsightsSummary(projectId: string): Observable<InsightSummary> {
    return this.http.get<InsightSummary>(`${this.PROJECTS_BASE}/${projectId}/insights/summary`);
  }
}
