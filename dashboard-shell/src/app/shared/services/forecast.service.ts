import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ForecastType = 'COMPLETION' | 'RISK_TREND' | 'VELOCITY' | 'PORTFOLIO';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type TrendDirection = 'WORSENING' | 'IMPROVING' | 'STABLE';

export interface RiskHistoryEntry {
  date: string;
  score: number;
}

export interface VelocityTrend {
  slope: number;
  r2: number;
}

export interface CompletionForecast {
  forecastId?: string;
  forecastType: 'COMPLETION';
  projectId: string;
  projectName: string;
  remainingPoints: number;
  avgVelocity: number;
  sprintVelocities: number[];
  velocityTrend: VelocityTrend;
  estimatedSprintsRemaining: number | null;
  estimatedCompletionDate: string | null;
  confidence: ConfidenceLevel;
}

export interface RiskTrendProjection {
  weekOffset: number;
  projectedScore: number;
}

export interface RiskTrendForecast {
  forecastId?: string;
  forecastType: 'RISK_TREND';
  projectId: string;
  projectName: string;
  riskHistory: RiskHistoryEntry[];
  trend: { slope: number; r2: number; direction: TrendDirection };
  projections: RiskTrendProjection[];
  confidence: ConfidenceLevel;
}

export interface VelocityProjection {
  sprintOffset: number;
  projectedVelocity: number;
}

export interface VelocityForecast {
  forecastId?: string;
  forecastType: 'VELOCITY';
  projectId: string;
  projectName: string;
  sprintVelocities: number[];
  trend: VelocityTrend;
  projections: VelocityProjection[];
  confidence: ConfidenceLevel;
}

export interface PortfolioSummary {
  worseningCount: number;
  improvingCount: number;
  stableCount: number;
  atRiskCount: number;
}

export interface PortfolioForecast {
  forecastId?: string;
  forecastType: 'PORTFOLIO';
  totalProjects: number;
  forecastedProjects: number;
  completionForecasts: CompletionForecast[];
  riskTrends: RiskTrendForecast[];
  summary: PortfolioSummary;
  generatedAt: string;
}

export type AnyForecast = CompletionForecast | RiskTrendForecast | VelocityForecast | PortfolioForecast;

export interface ForecastListResponse {
  forecasts: AnyForecast[];
  total: number;
}

export interface GenerateForecastPayload {
  forecastType: ForecastType;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ForecastService {
  private readonly BASE = '/api/forecasts';

  constructor(private http: HttpClient) {}

  generate(payload: GenerateForecastPayload): Observable<AnyForecast> {
    return this.http.post<AnyForecast>(`${this.BASE}/generate`, payload);
  }

  list(filters?: { forecastType?: ForecastType; projectId?: string }): Observable<ForecastListResponse> {
    let params = new HttpParams();
    if (filters?.forecastType) params = params.set('forecastType', filters.forecastType);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    return this.http.get<ForecastListResponse>(this.BASE, { params });
  }

  getForecast(forecastId: string): Observable<AnyForecast> {
    return this.http.get<AnyForecast>(`${this.BASE}/${forecastId}`);
  }
}
