import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../services/auth.service';

interface NavItem {
  icon: string;
  label: string;
  route: string;
  permissions?: string[];
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  template: `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <mat-icon>shield_admin</mat-icon>
          <span class="logo-text">RiskIntel</span>
        </div>
      </div>

      <nav class="nav-menu">
        <a *ngFor="let item of visibleItems"
           [routerLink]="item.route"
           routerLinkActive="active"
           class="nav-item">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span class="nav-label">{{ item.label }}</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <button mat-icon-button class="help-btn" title="Help">
          <mat-icon>help</mat-icon>
        </button>
        <button mat-icon-button class="settings-btn" title="Settings">
          <mat-icon>settings</mat-icon>
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      background-color: #f8fafc;
      border-right: 1px solid var(--ri-outline-variant);
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      box-shadow: 1px 0 3px rgba(0, 0, 0, 0.08);
    }

    .sidebar-header {
      padding: 24px 16px 32px 16px;
      border-bottom: 1px solid var(--ri-outline-variant);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
    }

    .logo mat-icon {
      color: var(--ri-primary);
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .logo-text {
      font-size: 18px;
      font-weight: 700;
      color: var(--ri-on-surface);
      letter-spacing: -0.01em;
    }

    .nav-menu {
      flex: 1;
      padding: 12px 0;
      display: flex;
      flex-direction: column;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      color: var(--ri-on-surface-variant);
      text-decoration: none;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;

      &:hover {
        background-color: rgba(79, 70, 229, 0.05);
        color: var(--ri-primary);
      }

      &.active {
        background-color: rgba(79, 70, 229, 0.1);
        border-left-color: var(--ri-primary);
        color: var(--ri-primary);
        font-weight: 600;
      }
    }

    .nav-label {
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid var(--ri-outline-variant);
      display: flex;
      gap: 8px;
    }

    .help-btn, .settings-btn {
      flex: 1;
      color: var(--ri-on-surface-variant);
      transition: color 0.2s ease;

      &:hover {
        color: var(--ri-primary);
      }
    }
  `],
})
export class SidebarComponent implements OnInit {
  visibleItems: NavItem[] = [];

  private allItems: NavItem[] = [
    {
      icon: 'dashboard',
      label: 'Delivery Dashboard',
      route: '/dashboard',
      roles: ['admin', 'delivery_manager', 'program_manager', 'director'],
    },
    {
      icon: 'engineering',
      label: 'Engineering Insights',
      route: '/engineering',
      roles: ['admin', 'engineering_lead', 'director'],
    },
    {
      icon: 'task_alt',
      label: 'Action Center',
      route: '/actions',
      roles: ['admin', 'delivery_manager', 'program_manager'],
    },
    {
      icon: 'folder_open',
      label: 'Active Projects',
      route: '/projects',
      permissions: ['projects:read'],
    },
    {
      icon: 'warning',
      label: 'Risk Analysis',
      route: '/risk',
      permissions: ['risk:read'],
    },
    {
      icon: 'history',
      label: 'Audit Trail',
      route: '/audit',
      permissions: ['audit:read'],
    },
    {
      icon: 'speed',
      label: 'Performance',
      route: '/performance',
      roles: ['admin'],
    },
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.updateVisibleItems();
    this.authService.user$.subscribe(() => {
      this.updateVisibleItems();
    });
  }

  private updateVisibleItems(): void {
    this.visibleItems = this.allItems.filter(item => {
      // No restrictions = always visible
      if (!item.roles && !item.permissions) return true;

      const hasRole = !item.roles || this.authService.hasRole(item.roles);
      const hasPerms = !item.permissions || item.permissions.every(p => this.authService.hasPermission(p));

      return hasRole && hasPerms;
    });
  }
}
