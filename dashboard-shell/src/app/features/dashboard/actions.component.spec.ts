import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActionsComponent } from './actions.component';
import { RiskService, ProjectAnomaly } from '../../shared/services/risk.service';
import { ProjectsService, ProjectItem } from '../../shared/services/projects.service';
import { of, throwError } from 'rxjs';

describe('ActionsComponent', () => {
  let component: ActionsComponent;
  let fixture: ComponentFixture<ActionsComponent>;
  let mockRiskService: any;
  let mockProjectsService: any;

  const mockProject: ProjectItem = {
    id: 'proj-1',
    name: 'Project Alpha',
    description: 'Test project',
    status: 'active',
    team: 'Team A',
  };

  const mockAnomaly: ProjectAnomaly = {
    projectId: 'proj-1',
    severity: 'HIGH',
    anomalyScore: 75,
    trend: 'regression',
    reasons: ['High event count', 'Trend worsening'],
    metrics: {
      totalEvents: 15,
      severityCounts: { critical: 5, high: 10, medium: 0, low: 0 },
      latestEventAt: new Date().toISOString(),
    },
  };

  beforeEach(async () => {
    localStorage.removeItem('ri-action-status-v1');

    mockRiskService = {
      getPortfolioAnomalies: jasmine.createSpy('getPortfolioAnomalies').and.returnValue(of([mockAnomaly])),
    };

    mockProjectsService = {
      getProjects: jasmine.createSpy('getProjects').and.returnValue(of({ projects: [mockProject], total: 1 })),
    };

    await TestBed.configureTestingModule({
      imports: [ActionsComponent],
      providers: [
        { provide: RiskService, useValue: mockRiskService },
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load and aggregate recommended actions on init', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      expect(component.loading).toBeFalse();
      expect(component.allActions.length).toBeGreaterThan(0);
      expect(component.allActions[0].projectName).toBe('Project Alpha');
      done();
    }, 100);
  });

  it('should prioritize actions by severity', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const severities = component.allActions.map(a => a.severity);
      for (let i = 1; i < severities.length; i++) {
        expect(['CRITICAL', 'HIGH'].includes(severities[0])).toBeTrue();
      }
      done();
    }, 100);
  });

  it('should handle anomalies without matching projects', (done) => {
    const orphanAnomaly: ProjectAnomaly = { ...mockAnomaly, projectId: 'unknown-proj' };
    mockRiskService.getPortfolioAnomalies.and.returnValue(of([mockAnomaly, orphanAnomaly]));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.allActions.every(a => a.projectId !== 'unknown-proj')).toBeTrue();
      done();
    }, 100);
  });

  it('should track action status changes', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const action = component.allActions[0];
      expect(component.actionStatuses.get(action.id)).toBe('open');

      component.markInProgress(action);
      expect(component.actionStatuses.get(action.id)).toBe('in_progress');

      component.markCompleted(action);
      expect(component.actionStatuses.get(action.id)).toBe('completed');

      component.markOpen(action);
      expect(component.actionStatuses.get(action.id)).toBe('open');

      done();
    }, 100);
  });

  it('should filter actions by status', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      if (component.allActions.length > 0) {
        component.markCompleted(component.allActions[0]);
      }

      const openActions = component.filteredActions('open');
      const completedActions = component.filteredActions('completed');

      expect(openActions.every(a => component.actionStatuses.get(a.id) === 'open')).toBeTrue();
      expect(completedActions.every(a => component.actionStatuses.get(a.id) === 'completed')).toBeTrue();
      done();
    }, 100);
  });

  it('should update stats on status change', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const initialOpen = component.totalActions;
      if (component.allActions.length > 0) {
        component.markCompleted(component.allActions[0]);
      }

      expect(component.totalActions).toBeLessThan(initialOpen);
      expect(component.completedCount).toBeGreaterThan(0);
      done();
    }, 100);
  });

  it('should count critical actions correctly', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const criticalOpen = component.allActions.filter(
        a => a.severity === 'CRITICAL' && component.actionStatuses.get(a.id) === 'open'
      );
      expect(component.criticalCount).toBe(criticalOpen.length);
      done();
    }, 100);
  });

  it('should categorize actions appropriately', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const categories = new Set(component.allActions.map(a => a.category));
      expect(categories.size).toBeGreaterThan(0);
      done();
    }, 100);
  });

  it('should format dates relative to now', () => {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    expect(component.formatDate(now)).toBe('just now');
    expect(component.formatDate(oneMinuteAgo)).toContain('m ago');
    expect(component.formatDate(oneHourAgo)).toContain('h ago');
    expect(component.formatDate(oneDayAgo)).toContain('d ago');
  });

  it('should handle service errors gracefully', (done) => {
    mockRiskService.getPortfolioAnomalies.and.returnValue(
      throwError(() => new Error('Service error'))
    );
    mockProjectsService.getProjects.and.returnValue(
      throwError(() => new Error('Service error'))
    );

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.loading).toBeFalse();
      expect(component.allActions.length).toBe(0);
      done();
    }, 100);
  });

  it('should handle missing data gracefully', (done) => {
    mockRiskService.getPortfolioAnomalies.and.returnValue(of([]));
    mockProjectsService.getProjects.and.returnValue(of({ projects: [], total: 0 }));

    fixture.detectChanges();

    setTimeout(() => {
      expect(component.loading).toBeFalse();
      expect(component.allActions.length).toBe(0);
      done();
    }, 100);
  });

  it('should persist action status changes in localStorage', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const action = component.allActions[0];
      component.markCompleted(action);

      const stored = localStorage.getItem('ri-action-status-v1');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored || '{}');
      expect(parsed[action.id]).toBe('completed');
      done();
    }, 100);
  });

  it('should restore stored statuses after component reload', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const firstAction = component.allActions[0];
      component.markInProgress(firstAction);

      const secondFixture = TestBed.createComponent(ActionsComponent);
      const secondComponent = secondFixture.componentInstance;
      secondFixture.detectChanges();

      setTimeout(() => {
        const reloadedAction = secondComponent.allActions.find(a => a.id === firstAction.id);
        expect(reloadedAction).toBeTruthy();
        expect(secondComponent.actionStatuses.get(firstAction.id)).toBe('in_progress');
        done();
      }, 100);
    }, 100);
  });

  it('should compute adoption rate from in-progress and completed actions', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const actions = component.allActions;
      expect(actions.length).toBeGreaterThan(0);

      component.markInProgress(actions[0]);
      if (actions.length > 1) {
        component.markCompleted(actions[1]);
      }

      const adopted = component.inProgressCount + component.completedCount;
      const expectedRate = Math.round((adopted / actions.length) * 100);
      expect(component.adoptionRate).toBe(expectedRate);
      done();
    }, 100);
  });
});
