import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AgentWorkbenchInsight {
  id: string;
  domain: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  detail: string;
  action: string;
}

export interface AgentWorkbenchRecommendation {
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

export interface AgentWorkbenchAgent {
  key: string;
  name: string;
  status: 'ACTIVE' | 'WATCH' | 'MONITORING' | 'IDLE' | 'READY';
  summary: Record<string, string | number | string[]>;
}

export interface AgentWorkbench {
  projectId: string;
  projectName: string;
  team: string;
  status: string;
  riskScore: number;
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  generatedAt: string;
  agents: AgentWorkbenchAgent[];
  summaries: {
    insights: {
      totalInsights: number;
      severityCounts: {
        INFO: number;
        WARNING: number;
        CRITICAL: number;
      };
      domainCounts: Record<string, number>;
    };
    recommendations: {
      totalRecommendations: number;
      priorityCounts: {
        P1: number;
        P2: number;
        P3: number;
      };
      ownerRoleCounts: Record<string, number>;
      domainCounts: Record<string, number>;
    };
  };
  previews: {
    insights: AgentWorkbenchInsight[];
    recommendations: AgentWorkbenchRecommendation[];
  };
  nextActions: Array<{
    id: string;
    priority: 'P1' | 'P2' | 'P3';
    ownerRole: string;
    title: string;
    description: string;
  }>;
  serviceStatus?: {
    core: string;
    feedback: string;
    reporting: string;
    forecasting: string;
  };
  feedbackLearning?: {
    total: number;
    acceptanceRate: number;
    topRejected: Array<{ targetId: string; count: number }>;
  } | null;
  latestReport?: {
    reportType: string;
    sections?: {
      executiveSummary?: {
        overallRag?: string;
        openRecommendations?: number;
      };
    };
  } | null;
  latestForecast?: {
    forecastType: string;
    summary?: {
      atRiskCount?: number;
      worseningCount?: number;
    };
  } | null;
}

@Injectable({
  providedIn: 'root',
})
export class AgentWorkbenchService {
  private readonly AGENTS_BASE = '/api/agents/projects';

  constructor(private http: HttpClient) {}

  getProjectAgentWorkbench(
    projectId: string,
    options?: { insightLimit?: number; recommendationLimit?: number }
  ): Observable<{ workbench: AgentWorkbench }> {
    let params = new HttpParams();

    if (options?.insightLimit) {
      params = params.set('insightLimit', String(options.insightLimit));
    }

    if (options?.recommendationLimit) {
      params = params.set('recommendationLimit', String(options.recommendationLimit));
    }

    return this.http.get<{ workbench: AgentWorkbench }>(`${this.AGENTS_BASE}/${projectId}/workbench`, { params });
  }
}