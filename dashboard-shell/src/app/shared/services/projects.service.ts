import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type ProjectStatus = 'active' | 'paused' | 'at_risk' | 'completed';

export interface ProjectItem {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  team: string;
  startDate?: string;
  targetDate?: string | null;
  metadata?: {
    repo?: string;
    jiraBoard?: string;
    qaEndpoint?: string;
    ciProvider?: string;
  };
}

interface ProjectsResponse {
  projects: ProjectItem[];
  total: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  private readonly PROJECTS_BASE = '/api/projects';

  constructor(private http: HttpClient) {}

  getProjects(filters?: { status?: ProjectStatus; team?: string }): Observable<ProjectsResponse> {
    let params = new HttpParams();

    if (filters?.status) {
      params = params.set('status', filters.status);
    }

    if (filters?.team) {
      params = params.set('team', filters.team);
    }

    return this.http.get<ProjectsResponse>(this.PROJECTS_BASE, { params });
  }
}
