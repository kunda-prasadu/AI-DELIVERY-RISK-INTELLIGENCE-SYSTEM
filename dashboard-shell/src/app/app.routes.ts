import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/components/layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ProjectsComponent } from './features/projects/projects.component';
import { RiskComponent } from './features/risk/risk.component';
import { EngineeringComponent } from './features/dashboard/engineering.component';
import { ActionsComponent } from './features/dashboard/actions.component';

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'projects', component: ProjectsComponent },
      { path: 'risk', component: RiskComponent },
      { path: 'engineering', component: EngineeringComponent },
      { path: 'actions', component: ActionsComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

