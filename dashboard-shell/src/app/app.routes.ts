import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/projects.component').then(m => m.ProjectsComponent),
      },
      {
        path: 'risk',
        loadComponent: () => import('./features/risk/risk.component').then(m => m.RiskComponent),
      },
      {
        path: 'risk/anomalies/:projectId',
        loadComponent: () =>
          import('./features/risk/risk-anomaly-detail.component').then(m => m.RiskAnomalyDetailComponent),
      },
      {
        path: 'engineering',
        loadComponent: () =>
          import('./features/dashboard/engineering.component').then(m => m.EngineeringComponent),
      },
      {
        path: 'actions',
        loadComponent: () => import('./features/dashboard/actions.component').then(m => m.ActionsComponent),
      },
      {
        path: 'audit',
        loadComponent: () => import('./features/security/audit-trail.component').then(m => m.AuditTrailComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

