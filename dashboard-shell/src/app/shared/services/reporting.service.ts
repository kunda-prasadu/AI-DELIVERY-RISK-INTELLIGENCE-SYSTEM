import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReportProject {
  id: string;
  name: string;
  riskScore: number;
  status: string;
}

export interface PortfolioHealth {
  totalProjects: number;
  atRisk: number;
  onTrack: number;
  ragBreakdown: { RED: number; AMBER: number; GREEN: number };
}

export interface ExecutiveSummarySection {
  portfolioHealth: PortfolioHealth;
  averageRiskScore: number;
  overallRag: 'RED' | 'AMBER' | 'GREEN';
  openInsights: number;
  openRecommendations: number;
  anomalyCount: number;
}

export interface TopRiskEntry {
  projectId: string;
  projectName: string;
  riskScore: number;
  rag: 'RED' | 'AMBER' | 'GREEN';
  status: string;
}

export interface ExecutiveReport {
  reportId: string;
  reportType: 'executive-summary' | 'risk-deep-dive' | 'portfolio-health';
  requestedBy: string;
  generatedAt: string;
  sections: {
    executiveSummary: ExecutiveSummarySection;
    topRisks: TopRiskEntry[];
  };
  markdown?: string;
}

export interface GenerateReportPayload {
  reportType?: 'executive-summary' | 'risk-deep-dive' | 'portfolio-health';
  requestedBy?: string;
  projects?: ReportProject[];
  openInsights?: number;
  openRecommendations?: number;
  anomalyCount?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReportingService {
  private readonly BASE = '/api/reports';

  constructor(private http: HttpClient) {}

  generateReport(payload: GenerateReportPayload): Observable<{ report: ExecutiveReport }> {
    return this.http.post<{ report: ExecutiveReport }>(`${this.BASE}/generate`, payload);
  }

  listReports(filters?: { reportType?: string; requestedBy?: string }): Observable<{ reports: ExecutiveReport[]; total: number }> {
    let params = new HttpParams();
    if (filters?.reportType) params = params.set('reportType', filters.reportType);
    if (filters?.requestedBy) params = params.set('requestedBy', filters.requestedBy);
    return this.http.get<{ reports: ExecutiveReport[]; total: number }>(this.BASE, { params });
  }

  getReport(reportId: string): Observable<{ report: ExecutiveReport }> {
    return this.http.get<{ report: ExecutiveReport }>(`${this.BASE}/${reportId}`);
  }
}
