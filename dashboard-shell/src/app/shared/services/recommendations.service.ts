import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecommendationItem {
  id: string;
  projectId: string;
  priority: 'P1' | 'P2' | 'P3';
  domain: string;
  ownerRole: string;
  title: string;
  description: string;
  rationale: string;
  sourceInsightIds: string[];
  confidence: number;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE';
}

interface RecommendationsResponse {
  projectId: string;
  riskScore: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: RecommendationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  generatedAt: string;
}

export interface RecommendationSummary {
  projectId: string;
  riskScore: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  totalRecommendations: number;
  priorityCounts: {
    P1: number;
    P2: number;
    P3: number;
  };
  ownerRoleCounts: Record<string, number>;
  domainCounts: Record<string, number>;
  generatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class RecommendationsService {
  private readonly PROJECTS_BASE = '/api/projects';

  constructor(private http: HttpClient) {}

  getProjectRecommendations(
    projectId: string,
    filters?: { priority?: 'P1' | 'P2' | 'P3'; domain?: string; ownerRole?: string; page?: number; limit?: number }
  ): Observable<RecommendationsResponse> {
    let params = new HttpParams();

    if (filters?.priority) {
      params = params.set('priority', filters.priority);
    }

    if (filters?.domain) {
      params = params.set('domain', filters.domain);
    }

    if (filters?.ownerRole) {
      params = params.set('ownerRole', filters.ownerRole);
    }

    if (filters?.page) {
      params = params.set('page', String(filters.page));
    }

    if (filters?.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.http.get<RecommendationsResponse>(`${this.PROJECTS_BASE}/${projectId}/recommendations`, { params });
  }

  getProjectRecommendationsSummary(projectId: string): Observable<RecommendationSummary> {
    return this.http.get<RecommendationSummary>(`${this.PROJECTS_BASE}/${projectId}/recommendations/summary`);
  }
}
