import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditEntry {
  auditId: string;
  timestamp: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  hash: string;
}

export interface AuditIntegrity {
  valid: boolean;
  totalEntries: number;
  brokenAt: string | null;
  lastHash: string | null;
}

export interface AuditListResponse {
  entries: AuditEntry[];
  total: number;
  integrity: AuditIntegrity;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly BASE = '/api/auth/audit';

  constructor(private http: HttpClient) {}

  list(filters?: { action?: string; outcome?: string; actorId?: string; limit?: number }): Observable<AuditListResponse> {
    let params = new HttpParams();
    if (filters?.action) params = params.set('action', filters.action);
    if (filters?.outcome) params = params.set('outcome', filters.outcome);
    if (filters?.actorId) params = params.set('actorId', filters.actorId);
    if (typeof filters?.limit === 'number') params = params.set('limit', String(filters.limit));
    return this.http.get<AuditListResponse>(this.BASE, { params });
  }
}
