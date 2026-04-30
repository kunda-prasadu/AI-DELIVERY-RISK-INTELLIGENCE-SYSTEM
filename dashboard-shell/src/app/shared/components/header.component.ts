import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService, AuthUser } from '../services/auth.service';
import { AlertService } from '../services/alert.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule],
  template: `
    <header class="header">
      <div class="header-left">
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search risks, projects..." />
        </div>
      </div>

      <div class="header-right">
        <button mat-icon-button class="icon-btn" title="Active Alerts">
          <mat-icon class="notification-icon">notifications</mat-icon>
          <span class="notification-badge" *ngIf="activeAlertCount > 0">{{ activeAlertCount > 99 ? '99+' : activeAlertCount }}</span>
        </button>

        <button mat-icon-button class="icon-btn" title="Export">
          <mat-icon>download</mat-icon>
        </button>

        <button mat-icon-button class="icon-btn" title="Settings">
          <mat-icon>settings</mat-icon>
        </button>

        <button mat-icon-button [matMenuTriggerFor]="userMenu" class="user-btn">
          <div class="user-avatar">{{ initials }}</div>
        </button>
        <mat-menu #userMenu="matMenu">
          <button mat-menu-item disabled>
            {{ currentUser?.email }}
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item>Profile</button>
          <button mat-menu-item>Settings</button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">Logout</button>
        </mat-menu>
      </div>
    </header>
  `,
  styles: [`
    .header {
      background-color: #ffffff;
      border-bottom: 1px solid var(--ri-outline-variant);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 64px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }

    .header-left {
      flex: 1;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background-color: var(--ri-surface-container);
      border: 1px solid var(--ri-outline-variant);
      border-radius: 8px;
      padding: 8px 12px;
      max-width: 400px;
      color: var(--ri-on-surface-variant);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--ri-on-surface-variant);
      }

      input {
        border: none;
        background: transparent;
        outline: none;
        font-size: 14px;
        color: var(--ri-on-surface);
        flex: 1;

        &::placeholder {
          color: var(--ri-on-surface-variant);
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .icon-btn {
      color: var(--ri-on-surface-variant);
      transition: color 0.2s ease;

      &:hover {
        color: var(--ri-primary);
      }
    }

    .notification-icon {
      position: relative;
    }

    .notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background-color: var(--ri-error);
      color: white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
    }

    .user-btn {
      width: 40px;
      height: 40px;
      padding: 0;
      margin-left: 8px;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--ri-primary), var(--ri-primary-container));
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 14px;
    }
  `],
})
export class HeaderComponent implements OnInit {
  currentUser: AuthUser | null = null;
  initials = 'U';
  activeAlertCount = 0;

  constructor(
    private authService: AuthService,
    private alertService: AlertService,
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        const parts = user.email.split('@')[0].split('.');
        this.initials = (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
      }
    });

    this.alertService.getActiveAlertCount().subscribe(count => {
      this.activeAlertCount = count;
    });
  }

  logout(): void {
    this.authService.logout();
    // In a real app, navigate to login; for now just clear
    window.location.href = '/';
  }
}
