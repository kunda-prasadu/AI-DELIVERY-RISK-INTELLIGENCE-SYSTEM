import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type FeedbackSignal = 'accepted' | 'rejected' | 'deferred' | 'corrected';
export type FeedbackTargetType = 'recommendation' | 'insight' | 'anomaly' | 'report';

export interface FeedbackEntry {
  feedbackId: string;
  projectId: string;
  targetType: FeedbackTargetType;
  targetId: string;
  signal: FeedbackSignal;
  submittedBy: string;
  comment: string;
  correctedValue?: unknown;
  createdAt: string;
}

export interface SubmitFeedbackPayload {
  projectId: string;
  targetType: FeedbackTargetType;
  targetId: string;
  signal: FeedbackSignal;
  submittedBy?: string;
  comment?: string;
  correctedValue?: unknown;
}

export interface LearningByTargetType {
  total: number;
  accepted: number;
  rejected: number;
}

export interface LearningSummary {
  total: number;
  signalCounts: Record<FeedbackSignal, number>;
  acceptanceRate: number;
  rejectionRate: number;
  byTargetType: Record<FeedbackTargetType, LearningByTargetType>;
  corrections: Array<{ feedbackId: string; targetId: string; targetType: string; correctedValue: unknown; createdAt: string }>;
  topRejected: Array<{ targetId: string; count: number }>;
  generatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly BASE = '/api/feedback';

  constructor(private http: HttpClient) {}

  submit(payload: SubmitFeedbackPayload): Observable<{ feedback: FeedbackEntry }> {
    return this.http.post<{ feedback: FeedbackEntry }>(this.BASE, payload);
  }

  list(filters?: { targetType?: string; targetId?: string; signal?: string; projectId?: string }): Observable<{ feedback: FeedbackEntry[]; total: number }> {
    let params = new HttpParams();
    if (filters?.targetType) params = params.set('targetType', filters.targetType);
    if (filters?.targetId) params = params.set('targetId', filters.targetId);
    if (filters?.signal) params = params.set('signal', filters.signal);
    if (filters?.projectId) params = params.set('projectId', filters.projectId);
    return this.http.get<{ feedback: FeedbackEntry[]; total: number }>(this.BASE, { params });
  }

  getLearning(projectId?: string): Observable<{ learning: LearningSummary }> {
    let params = new HttpParams();
    if (projectId) params = params.set('projectId', projectId);
    return this.http.get<{ learning: LearningSummary }>(`${this.BASE}/learning`, { params });
  }
}
