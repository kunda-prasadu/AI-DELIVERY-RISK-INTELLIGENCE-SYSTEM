import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { RiskService, RiskScore } from '../services/risk.service';

@Component({
  selector: 'app-risk-heatmap',
  standalone: true,
  imports: [CommonModule, MatGridListModule, MatTooltipModule, MatIconModule],
  template: `
    <div class="heatmap-container">
      <div class="heatmap-header">
        <h3 class="heatmap-title">Project Risk Heatmap</h3>
        <div class="heatmap-legend">
          <div class="legend-item low">
            <span class="legend-color"></span>
            <span>Low</span>
          </div>
          <div class="legend-item medium">
            <span class="legend-color"></span>
            <span>Medium</span>
          </div>
          <div class="legend-item high">
            <span class="legend-color"></span>
            <span>High</span>
          </div>
          <div class="legend-item critical">
            <span class="legend-color"></span>
            <span>Critical</span>
          </div>
        </div>
      </div>

      <mat-grid-list cols="5" rowHeight="120px" gutterSize="8px" class="heatmap-grid">
        <mat-grid-tile
          *ngFor="let score of riskScores"
          [ngStyle]="{ background: getBackgroundColor(score.band) }"
          class="heatmap-cell"
          [matTooltip]="getTooltip(score)"
          matTooltipPosition="above"
        >
          <div class="cell-content">
            <div class="cell-score" [ngStyle]="{ color: getTextColor(score.band) }">
              {{ score.score }}
            </div>
            <div class="cell-name">{{ score.projectName }}</div>
            <div class="cell-band" [ngStyle]="{ color: getTextColor(score.band) }">
              {{ score.band }}
            </div>
            <mat-icon class="severity-icon" [ngStyle]="{ color: getTextColor(score.band) }">
              {{ getSeverityIcon(score.band) }}
            </mat-icon>
          </div>
        </mat-grid-tile>
      </mat-grid-list>
    </div>
  `,
  styles: [`
    .heatmap-container {
      padding: 16px;
      background: var(--ri-surface);
      border-radius: 8px;
    }

    .heatmap-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .heatmap-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--ri-on-surface);
    }

    .heatmap-legend {
      display: flex;
      gap: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;

      &.low {
        color: #2e7d32;
      }

      &.medium {
        color: #f9a825;
      }

      &.high {
        color: #f57c00;
      }

      &.critical {
        color: #ba1a1a;
      }
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;

      .low & {
        background: #e8f5e9;
      }

      .medium & {
        background: #fff8e1;
      }

      .high & {
        background: #ffe8cc;
      }

      .critical & {
        background: #ffebee;
      }
    }

    .heatmap-grid {
      width: 100%;
    }

    .heatmap-cell {
      border-radius: 6px;
      transition: all 0.2s ease;
      cursor: pointer;
      border: 1px solid rgba(0, 0, 0, 0.08);

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: scale(0.98);
      }
    }

    .cell-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 12px;
    }

    .cell-score {
      font-size: 28px;
      font-weight: 700;
      line-height: 1;
      margin-bottom: 4px;
    }

    .cell-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--ri-on-surface);
      margin-bottom: 4px;
      word-wrap: break-word;
    }

    .cell-band {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .severity-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }
  `],
})
export class RiskHeatmapComponent implements OnInit {
  @Input() riskScores: RiskScore[] = [];

  constructor(private riskService: RiskService) {}

  ngOnInit(): void {
    if (this.riskScores.length) {
      this.riskScores = [...this.riskScores].sort((a, b) => b.score - a.score);
      return;
    }

    this.riskService.getRiskScores().subscribe(scores => {
      this.riskScores = scores.sort((a, b) => b.score - a.score);
    });
  }

  getBackgroundColor(band: string): string {
    return this.riskService.getBandBackgroundColor(band);
  }

  getTextColor(band: string): string {
    return this.riskService.getBandColor(band);
  }

  getSeverityIcon(band: string): string {
    const icons: { [key: string]: string } = {
      LOW: 'check_circle',
      MEDIUM: 'warning',
      HIGH: 'error',
      CRITICAL: 'dangerous',
    };
    return icons[band] || 'help';
  }

  getTooltip(score: RiskScore): string {
    return `${score.projectName} - ${score.band} (${score.score})
Code Velocity: ${score.signals.codeVelocity}
Quality: ${score.signals.quality}
CI/CD: ${score.signals.cicd}
Jira Velocity: ${score.signals.jiraVelocity}`;
  }
}
