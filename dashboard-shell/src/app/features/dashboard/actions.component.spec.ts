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
    localStorage.removeItem('ri-action-telemetry-v1');
    localStorage.removeItem('ri-action-telemetry-pins-v1');
    localStorage.removeItem('ri-action-telemetry-navigator-prefs-v1');

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

  it('should persist telemetry snapshots when status distribution changes', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const baseline = component.adoptionTelemetry.length;
      component.markInProgress(component.allActions[0]);

      const telemetryRaw = localStorage.getItem('ri-action-telemetry-v1');
      expect(telemetryRaw).toBeTruthy();

      const telemetry = JSON.parse(telemetryRaw || '[]');
      expect(Array.isArray(telemetry)).toBeTrue();
      expect(component.adoptionTelemetry.length).toBeGreaterThanOrEqual(baseline);
      expect(component.adoptionTelemetry[component.adoptionTelemetry.length - 1].adoptionRate).toBe(component.adoptionRate);
      done();
    }, 100);
  });

  it('should restore telemetry from storage on component init', (done) => {
    const seed = [
      {
        timestamp: Date.now() - 3600000,
        openCount: 2,
        inProgressCount: 1,
        completedCount: 1,
        adoptionRate: 50,
      },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      expect(secondComponent.adoptionTelemetry.length).toBeGreaterThan(0);
      expect(secondComponent.adoptionTelemetry[0].adoptionRate).toBe(50);
      done();
    }, 100);
  });

  it('should compute adoption 24h delta from telemetry history', (done) => {
    const now = Date.now();
    const seed = [
      {
        timestamp: now - (26 * 60 * 60 * 1000),
        openCount: 4,
        inProgressCount: 0,
        completedCount: 0,
        adoptionRate: 0,
      },
      {
        timestamp: now - (2 * 60 * 60 * 1000),
        openCount: 2,
        inProgressCount: 1,
        completedCount: 1,
        adoptionRate: 50,
      },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      expect(secondComponent.adoptionDelta24h).toBe(-50);
      done();
    }, 100);
  });

  it('should filter telemetry points by selected window', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (8 * 24 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 0 },
      { timestamp: now - (12 * 60 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
      { timestamp: now - (30 * 60 * 1000), openCount: 2, inProgressCount: 1, completedCount: 2, adoptionRate: 60 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      expect(secondComponent.getTelemetryWindowPoints().length).toBe(2);

      secondComponent.setTelemetryWindow('24h');
      expect(secondComponent.getTelemetryWindowPoints().length).toBe(3);

      secondComponent.setTelemetryWindow('7d');
      expect(secondComponent.getTelemetryWindowPoints().length).toBe(3);
      done();
    }, 100);
  });

  it('should build telemetry polyline for chart rendering', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      component.markInProgress(component.allActions[0]);
      component.markCompleted(component.allActions[0]);

      const points = component.getTelemetryWindowPoints();
      const polyline = component.buildTelemetryPolyline(points);

      if (points.length >= 2) {
        expect(polyline.length).toBeGreaterThan(0);
        expect(polyline.includes(',')).toBeTrue();
      } else {
        expect(polyline).toBe('');
      }
      done();
    }, 100);
  });

  it('should compute window start and peak rates from filtered telemetry', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (60 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 0, adoptionRate: 20 },
      { timestamp: now - (10 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('24h');
      expect(secondComponent.getTelemetryWindowStartRate()).toBe(10);
      expect(secondComponent.getTelemetryWindowPeakRate()).toBeGreaterThanOrEqual(40);
      done();
    }, 100);
  });

  it('should expose chart points and labels for richer telemetry semantics', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (60 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 0, adoptionRate: 25 },
      { timestamp: now - (10 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('24h');

      const chartPoints = secondComponent.getTelemetryChartPoints();

      expect(chartPoints.length).toBe(4);
      expect(chartPoints.every((chartPoint) => chartPoint.x >= 4 && chartPoint.x <= secondComponent.chartWidth)).toBeTrue();
      expect(chartPoints.every((chartPoint) => chartPoint.y >= 0 && chartPoint.y <= secondComponent.chartHeight)).toBeTrue();
      expect(secondComponent.getTelemetryWindowLowRate()).toBe(0);
      expect(secondComponent.getTelemetryWindowStartLabel()).not.toBe('--');
      expect(secondComponent.getTelemetryWindowEndLabel()).not.toBe('--');
      done();
    }, 100);
  });

  it('should track the active telemetry point for hover detail and reset to the latest point', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (60 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 0, adoptionRate: 20 },
      { timestamp: now - (10 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('24h');
      const windowPoints = secondComponent.getTelemetryWindowPoints();
      const hoveredPoint = windowPoints[0];
      const latestPoint = windowPoints[windowPoints.length - 1];

      secondComponent.setHoveredTelemetryPoint(hoveredPoint);
      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(hoveredPoint.timestamp);
      expect(secondComponent.isActiveTelemetryPoint(hoveredPoint)).toBeTrue();

      secondComponent.clearHoveredTelemetryPoint();
      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(latestPoint.timestamp);
      expect(secondComponent.getTelemetryChartAriaLabel()).toContain('current highlighted point');
      done();
    }, 100);
  });

  it('should let the telemetry timeline select the active point in the current view', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (60 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 0, adoptionRate: 20 },
      { timestamp: now - (10 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('24h');
      const timelinePoint = secondComponent.getTelemetryTimelinePoints()[1];

      secondComponent.selectTelemetryTimelinePoint(timelinePoint);

      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(timelinePoint.timestamp);
      expect(secondComponent.isActiveTelemetryPoint(timelinePoint)).toBeTrue();

      secondComponent.clearHoveredTelemetryPoint();
      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(secondComponent.getTelemetryWindowPoints().slice(-1)[0].timestamp);
      done();
    }, 100);
  });

  it('should build overlay polylines for adoption, completed, and in-progress trend series', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (60 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
      { timestamp: now - (10 * 60 * 1000), openCount: 2, inProgressCount: 1, completedCount: 2, adoptionRate: 60 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('24h');
      const points = secondComponent.getTelemetryWindowPoints();

      expect(secondComponent.telemetrySeries.map((series) => series.key)).toEqual(['adoption', 'completed', 'inProgress']);
      expect(secondComponent.buildTelemetryPolyline(points, 'adoption')).not.toBe('');
      expect(secondComponent.buildTelemetryPolyline(points, 'completed')).not.toBe('');
      expect(secondComponent.buildTelemetryPolyline(points, 'inProgress')).not.toBe('');
      done();
    }, 100);
  });

  it('should recenter the telemetry view when selecting an older navigator point', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 20 }, (_, index) => ({
      timestamp: now - ((19 - index) * 30 * 60 * 1000),
      openCount: Math.max(20 - index, 0),
      inProgressCount: index % 3,
      completedCount: index,
      adoptionRate: Math.min(10 + (index * 4), 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);
      const beforeLatest = secondComponent.getTelemetryWindowPoints().slice(-1)[0];
      const navigatorPoint = secondComponent.getTelemetryNavigatorPoints()[2];

      expect(navigatorPoint).toBeTruthy();

      secondComponent.focusTelemetryPoint(navigatorPoint);

      const afterLatest = secondComponent.getTelemetryWindowPoints().slice(-1)[0];
      expect(secondComponent.telemetryPanOffsetSteps).toBeGreaterThan(0);
      expect(afterLatest.timestamp).toBeLessThan(beforeLatest.timestamp);
      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(navigatorPoint.timestamp);
      expect(secondComponent.canPanTelemetryNewer()).toBeTrue();
      done();
    }, 100);
  });

  it('should page older and newer navigator jump entries for deeper history exploration', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 50 }, (_, index) => ({
      timestamp: now - ((49 - index) * 30 * 60 * 1000),
      openCount: Math.max(50 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(5 + (index * 2), 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const firstPageHead = secondComponent.getTelemetryNavigatorPoints()[0];
      expect(secondComponent.canShiftTelemetryNavigatorOlder()).toBeTrue();

      secondComponent.shiftTelemetryNavigator('older');
      const secondPageHead = secondComponent.getTelemetryNavigatorPoints()[0];

      expect(secondComponent.telemetryNavigatorOffset).toBeGreaterThan(0);
      expect(secondPageHead.timestamp).toBeLessThan(firstPageHead.timestamp);
      expect(secondComponent.canShiftTelemetryNavigatorNewer()).toBeTrue();

      secondComponent.shiftTelemetryNavigator('newer');
      const resetPageHead = secondComponent.getTelemetryNavigatorPoints()[0];

      expect(secondComponent.telemetryNavigatorOffset).toBe(0);
      expect(resetPageHead.timestamp).toBe(firstPageHead.timestamp);
      done();
    }, 100);
  });

  it('should expose continuous jump history mode without page stepping', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 50 }, (_, index) => ({
      timestamp: now - ((49 - index) * 30 * 60 * 1000),
      openCount: Math.max(50 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(5 + (index * 2), 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const pagedPoints = secondComponent.getTelemetryNavigatorPoints();
      expect(pagedPoints.length).toBe(secondComponent.telemetryNavigatorPageSize);

      secondComponent.toggleTelemetryNavigatorContinuousMode();

      const continuousPoints = secondComponent.getTelemetryNavigatorPoints();
      expect(continuousPoints.length).toBeGreaterThan(pagedPoints.length);
      expect(secondComponent.canShiftTelemetryNavigatorOlder()).toBeFalse();
      expect(secondComponent.canShiftTelemetryNavigatorNewer()).toBeFalse();

      secondComponent.shiftTelemetryNavigator('older');
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);
      done();
    }, 100);
  });

  it('should flip jump order and keep older/newer paging semantics aligned to time direction', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 50 }, (_, index) => ({
      timestamp: now - ((49 - index) * 30 * 60 * 1000),
      openCount: Math.max(50 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(5 + (index * 2), 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const newestHead = secondComponent.getTelemetryNavigatorPoints()[0];
      expect(secondComponent.canShiftTelemetryNavigatorOlder()).toBeTrue();

      secondComponent.toggleTelemetryNavigatorSortOrder();

      const oldestHead = secondComponent.getTelemetryNavigatorPoints()[0];
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('oldest');
      expect(oldestHead.timestamp).toBeLessThan(newestHead.timestamp);
      expect(secondComponent.canShiftTelemetryNavigatorOlder()).toBeFalse();
      expect(secondComponent.canShiftTelemetryNavigatorNewer()).toBeTrue();

      secondComponent.shiftTelemetryNavigator('newer');
      expect(secondComponent.telemetryNavigatorOffset).toBeGreaterThan(0);

      secondComponent.shiftTelemetryNavigator('older');
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);
      done();
    }, 100);
  });

  it('should recenter to the live edge after navigating into older telemetry history', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 50 }, (_, index) => ({
      timestamp: now - ((49 - index) * 30 * 60 * 1000),
      openCount: Math.max(50 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(5 + (index * 2), 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const liveLatest = secondComponent.getTelemetryWindowPoints().slice(-1)[0];
      const olderPoint = secondComponent.getTelemetryNavigatorPoints()[2];
      expect(olderPoint).toBeTruthy();

      secondComponent.focusTelemetryPoint(olderPoint);
      expect(secondComponent.canRecenterTelemetryToLiveEdge()).toBeTrue();

      secondComponent.recenterTelemetryToLiveEdge();

      const recenteredLatest = secondComponent.getTelemetryWindowPoints().slice(-1)[0];
      expect(secondComponent.telemetryPanOffsetSteps).toBe(0);
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);
      expect(secondComponent.canPanTelemetryNewer()).toBeFalse();
      expect(secondComponent.canRecenterTelemetryToLiveEdge()).toBeFalse();
      expect(recenteredLatest.timestamp).toBe(liveLatest.timestamp);
      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(liveLatest.timestamp);
      done();
    }, 100);
  });

  it('should derive per-series rates for the active telemetry point', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 60 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (10 * 60 * 1000), openCount: 2, inProgressCount: 1, completedCount: 2, adoptionRate: 60 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('24h');
      const activePoint = secondComponent.getActiveTelemetryPoint();

      expect(activePoint).toBeTruthy();
      expect(secondComponent.getTelemetryRateForPoint(activePoint!, 'completed')).toBe(40);
      expect(secondComponent.getTelemetryRateForPoint(activePoint!, 'inProgress')).toBe(20);
      expect(secondComponent.getTelemetryChartAriaLabel()).toContain('completed');
      expect(secondComponent.getTelemetryChartAriaLabel()).toContain('in progress');
      done();
    }, 100);
  });

  it('should zoom the telemetry view to a narrower time slice', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (55 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (40 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 0, adoptionRate: 20 },
      { timestamp: now - (25 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
      { timestamp: now - (20 * 60 * 1000), openCount: 2, inProgressCount: 1, completedCount: 2, adoptionRate: 60 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      const fullWindowCount = secondComponent.getTelemetryWindowPoints().length;

      secondComponent.setTelemetryZoom(4);

      expect(secondComponent.telemetryZoomLevel).toBe(4);
      expect(secondComponent.getTelemetryWindowPoints().length).toBeLessThan(fullWindowCount);
      expect(secondComponent.getTelemetryViewSummary()).toContain('4x zoom');
      done();
    }, 100);
  });

  it('should preserve chart continuity when panning into sparse telemetry ranges', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (50 * 60 * 1000), openCount: 5, inProgressCount: 0, completedCount: 0, adoptionRate: 10 },
      { timestamp: now - (40 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 0, adoptionRate: 20 },
      { timestamp: now - (30 * 60 * 1000), openCount: 3, inProgressCount: 1, completedCount: 1, adoptionRate: 40 },
      { timestamp: now - (20 * 60 * 1000), openCount: 2, inProgressCount: 1, completedCount: 2, adoptionRate: 60 },
      { timestamp: now - (10 * 60 * 1000), openCount: 2, inProgressCount: 2, completedCount: 2, adoptionRate: 80 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const liveEdgeLatest = secondComponent.getTelemetryWindowPoints()[secondComponent.getTelemetryWindowPoints().length - 1];

      expect(secondComponent.canPanTelemetryOlder()).toBeTrue();

      secondComponent.panTelemetryWindow('older');
      const olderPoints = secondComponent.getTelemetryWindowPoints();
      const olderLatest = olderPoints[olderPoints.length - 1];
      const olderTimelineLatest = secondComponent.getTelemetryTimelinePoints()[0];

      expect(secondComponent.telemetryPanOffsetSteps).toBe(1);
      expect(olderPoints.length).toBeGreaterThanOrEqual(2);
      expect(olderLatest.timestamp).toBeLessThan(liveEdgeLatest.timestamp);
      expect(olderTimelineLatest.timestamp).toBe(olderLatest.timestamp);
      expect(secondComponent.canPanTelemetryNewer()).toBeTrue();

      secondComponent.panTelemetryWindow('newer');
      const resetLatest = secondComponent.getTelemetryWindowPoints()[secondComponent.getTelemetryWindowPoints().length - 1];
      const resetTimelineLatest = secondComponent.getTelemetryTimelinePoints()[0];

      expect(secondComponent.telemetryPanOffsetSteps).toBe(0);
      expect(resetLatest.timestamp).toBe(liveEdgeLatest.timestamp);
      expect(resetTimelineLatest.timestamp).toBe(liveEdgeLatest.timestamp);
      done();
    }, 100);
  });

  it('should retain older telemetry anchors while keeping recent history dense', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 90 }, (_, index) => ({
      timestamp: now - ((89 - index) * 60 * 1000),
      openCount: Math.max(90 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 1, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      expect(secondComponent.adoptionTelemetry.length).toBeGreaterThan(60);
      expect(secondComponent.adoptionTelemetry[0].timestamp).toBe(seed[0].timestamp);
      expect(secondComponent.adoptionTelemetry[secondComponent.adoptionTelemetry.length - 1].timestamp).toBeGreaterThanOrEqual(seed[seed.length - 1].timestamp);
      expect(secondComponent.adoptionTelemetry.slice(-61, -1).map((point) => point.timestamp)).toEqual(seed.slice(-60).map((point) => point.timestamp));
      done();
    }, 100);
  });

  it('should filter jump navigator points by a minimum adoption rate threshold', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 40 }, (_, index) => ({
      timestamp: now - ((39 - index) * 30 * 60 * 1000),
      openCount: Math.max(40 - index, 0),
      inProgressCount: index % 3,
      completedCount: index,
      adoptionRate: index * 2 + 5, // 5, 7, 9, ... 83  (40 points)
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);
      // Enable continuous mode so all navigator points are visible without pagination
      if (!secondComponent.telemetryNavigatorContinuousMode) {
        secondComponent.toggleTelemetryNavigatorContinuousMode();
      }

      // With no filter all non-window navigator points are present
      const unfiltered = secondComponent.getTelemetryNavigatorPoints();
      expect(unfiltered.length).toBeGreaterThan(0);

      // Apply a 50% minimum rate threshold
      secondComponent.setTelemetryNavigatorMinRate(50);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(50);
      const filtered = secondComponent.getTelemetryNavigatorPoints();
      expect(filtered.every((point) => point.adoptionRate >= 50)).toBeTrue();
      expect(filtered.length).toBeLessThan(unfiltered.length);

      // Offset is reset to 0 when threshold changes
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);

      // Clearing the threshold (set to 0) restores all points
      secondComponent.setTelemetryNavigatorMinRate(0);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(0);
      const restored = secondComponent.getTelemetryNavigatorPoints();
      expect(restored.length).toBe(unfiltered.length);

      // setTelemetryWindow resets threshold to 0
      secondComponent.setTelemetryNavigatorMinRate(75);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(75);
      secondComponent.setTelemetryWindow('24h');
      expect(secondComponent.telemetryNavigatorMinRate).toBe(0);
      done();
    }, 100);
  });

  it('should allow configuring telemetry navigator page size and paging step', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 70 }, (_, index) => ({
      timestamp: now - ((69 - index) * 30 * 60 * 1000),
      openCount: Math.max(70 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(10 + index, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const defaultPoints = secondComponent.getTelemetryNavigatorPoints();
      expect(defaultPoints.length).toBe(secondComponent.telemetryNavigatorPageSize);

      secondComponent.setTelemetryNavigatorPageSize(5);
      expect(secondComponent.telemetryNavigatorPageSize).toBe(5);
      expect(secondComponent.getTelemetryNavigatorPoints().length).toBe(5);

      secondComponent.shiftTelemetryNavigator('older');
      expect(secondComponent.telemetryNavigatorOffset).toBe(5);

      secondComponent.setTelemetryNavigatorPageSize(15);
      expect(secondComponent.telemetryNavigatorPageSize).toBe(15);
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);
      expect(secondComponent.getTelemetryNavigatorPoints().length).toBeLessThanOrEqual(15);

      secondComponent.setTelemetryNavigatorPageSize(999);
      expect(secondComponent.telemetryNavigatorPageSize).toBe(15);
      done();
    }, 100);
  });

  it('should keep pinned navigator snapshots at the top across filters and window resets', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 70 }, (_, index) => ({
      timestamp: now - ((69 - index) * 30 * 60 * 1000),
      openCount: Math.max(70 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 5, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);
      secondComponent.toggleTelemetryNavigatorContinuousMode();

      const candidate = secondComponent.getTelemetryNavigatorPoints().find((point) => point.adoptionRate < 40);
      expect(candidate).toBeTruthy();

      secondComponent.toggleTelemetryNavigatorPin(candidate!);
      expect(secondComponent.isTelemetryNavigatorPinned(candidate!)).toBeTrue();

      const pinnedTop = secondComponent.getTelemetryNavigatorPoints()[0];
      expect(pinnedTop.timestamp).toBe(candidate!.timestamp);

      secondComponent.setTelemetryNavigatorMinRate(95);
      const filteredWithPin = secondComponent.getTelemetryNavigatorPoints();
      expect(filteredWithPin[0].timestamp).toBe(candidate!.timestamp);
      expect(filteredWithPin.some((point) => point.timestamp === candidate!.timestamp)).toBeTrue();

      secondComponent.setTelemetryWindow('24h');
      const afterWindowReset = secondComponent.getTelemetryNavigatorPoints();
      expect(afterWindowReset[0].timestamp).toBe(candidate!.timestamp);

      secondComponent.setTelemetryNavigatorMinRate(95);
      secondComponent.toggleTelemetryNavigatorPin(candidate!);
      expect(secondComponent.isTelemetryNavigatorPinned(candidate!)).toBeFalse();

      const afterUnpin = secondComponent.getTelemetryNavigatorPoints();
      expect(afterUnpin.some((point) => point.timestamp === candidate!.timestamp)).toBeFalse();
      done();
    }, 100);
  });

  it('should persist pinned telemetry snapshots across component recreation and prune stale pins', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 20 }, (_, index) => ({
      timestamp: now - ((19 - index) * 30 * 60 * 1000),
      openCount: Math.max(20 - index, 0),
      inProgressCount: index % 3,
      completedCount: index,
      adoptionRate: Math.min(index + 5, 100),
    }));

    const staleTimestamp = now - (999 * 30 * 60 * 1000);
    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));
    localStorage.setItem('ri-action-telemetry-pins-v1', JSON.stringify([seed[5].timestamp, staleTimestamp]));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      expect(secondComponent.telemetryNavigatorPinnedTimestamps).toEqual([seed[5].timestamp]);

      const pinnedPoint = secondComponent.adoptionTelemetry.find((point) => point.timestamp === seed[5].timestamp);
      expect(pinnedPoint).toBeTruthy();
      expect(secondComponent.isTelemetryNavigatorPinned(pinnedPoint!)).toBeTrue();

      secondComponent.toggleTelemetryNavigatorPin(pinnedPoint!);
      expect(JSON.parse(localStorage.getItem('ri-action-telemetry-pins-v1') || '[]')).toEqual([]);

      secondComponent.toggleTelemetryNavigatorPin(pinnedPoint!);
      expect(JSON.parse(localStorage.getItem('ri-action-telemetry-pins-v1') || '[]')).toEqual([seed[5].timestamp]);

      const thirdFixture = TestBed.createComponent(ActionsComponent);
      const thirdComponent = thirdFixture.componentInstance;
      thirdFixture.detectChanges();

      setTimeout(() => {
        expect(thirdComponent.telemetryNavigatorPinnedTimestamps).toEqual([seed[5].timestamp]);
        done();
      }, 100);
    }, 100);
  });

  it('should bulk pin visible snapshots and block bulk pinning in continuous mode', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 70 }, (_, index) => ({
      timestamp: now - ((69 - index) * 30 * 60 * 1000),
      openCount: Math.max(70 - index, 0),
      inProgressCount: index % 3,
      completedCount: index,
      adoptionRate: Math.min(index + 5, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const visibleTimestamps = secondComponent.getTelemetryNavigatorPoints().map((point) => point.timestamp);
      expect(visibleTimestamps.length).toBeGreaterThan(0);
      expect(secondComponent.canPinVisibleTelemetryNavigatorPoints()).toBeTrue();

      secondComponent.pinVisibleTelemetryNavigatorPoints();

      expect(secondComponent.telemetryNavigatorPinnedTimestamps.length).toBeGreaterThanOrEqual(visibleTimestamps.length);
      expect(visibleTimestamps.every((timestamp) => secondComponent.telemetryNavigatorPinnedTimestamps.includes(timestamp))).toBeTrue();
      expect(JSON.parse(localStorage.getItem('ri-action-telemetry-pins-v1') || '[]').length).toBeGreaterThan(0);

      secondComponent.clearTelemetryNavigatorPins();
      expect(secondComponent.telemetryNavigatorPinnedTimestamps).toEqual([]);
      expect(JSON.parse(localStorage.getItem('ri-action-telemetry-pins-v1') || '[]')).toEqual([]);

      secondComponent.toggleTelemetryNavigatorContinuousMode();
      expect(secondComponent.canPinVisibleTelemetryNavigatorPoints()).toBeFalse();
      secondComponent.pinVisibleTelemetryNavigatorPoints();
      expect(secondComponent.telemetryNavigatorPinnedTimestamps).toEqual([]);
      expect(secondComponent.telemetryNavigatorPinLimitMessage).toContain('Bulk pinning is disabled');
      done();
    }, 100);
  });

  it('should enforce telemetry pin quota and warn when limit is reached', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 80 }, (_, index) => ({
      timestamp: now - ((79 - index) * 30 * 60 * 1000),
      openCount: Math.max(80 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 5, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);
      secondComponent.setTelemetryNavigatorPageSize(15);

      const pointsToPin = secondComponent.adoptionTelemetry.slice(0, secondComponent.telemetryNavigatorMaxPins);
      pointsToPin.forEach((point) => secondComponent.toggleTelemetryNavigatorPin(point));

      expect(secondComponent.telemetryNavigatorPinnedTimestamps.length).toBe(secondComponent.telemetryNavigatorMaxPins);

      const overflowPoint = secondComponent.adoptionTelemetry[secondComponent.telemetryNavigatorMaxPins + 1];
      secondComponent.toggleTelemetryNavigatorPin(overflowPoint);

      expect(secondComponent.isTelemetryNavigatorPinned(overflowPoint)).toBeFalse();
      expect(secondComponent.telemetryNavigatorPinnedTimestamps.length).toBe(secondComponent.telemetryNavigatorMaxPins);
      expect(secondComponent.telemetryNavigatorPinLimitMessage).toContain('Pin limit reached');

      secondComponent.clearTelemetryNavigatorPins();
      expect(secondComponent.telemetryNavigatorPinLimitMessage).toBe('');

      secondComponent.pinVisibleTelemetryNavigatorPoints();
      secondComponent.shiftTelemetryNavigator('older');
      secondComponent.pinVisibleTelemetryNavigatorPoints();

      expect(secondComponent.telemetryNavigatorPinnedTimestamps.length).toBe(secondComponent.telemetryNavigatorMaxPins);
      expect(secondComponent.telemetryNavigatorPinLimitMessage).toContain('Pinned');
      expect(secondComponent.telemetryNavigatorPinLimitMessage).toContain('limit');
      done();
    }, 100);
  });

  it('should expose pinned snapshot management actions for jump and unpin', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 60 }, (_, index) => ({
      timestamp: now - ((59 - index) * 30 * 60 * 1000),
      openCount: Math.max(60 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 5, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const firstPin = secondComponent.adoptionTelemetry[10];
      const secondPin = secondComponent.adoptionTelemetry[20];
      secondComponent.toggleTelemetryNavigatorPin(firstPin);
      secondComponent.toggleTelemetryNavigatorPin(secondPin);

      const pinnedPoints = secondComponent.getPinnedTelemetryNavigatorPoints();
      expect(pinnedPoints.length).toBe(2);

      secondComponent.jumpToPinnedTelemetrySnapshot(firstPin.timestamp);
      expect(secondComponent.getActiveTelemetryPoint()?.timestamp).toBe(firstPin.timestamp);

      secondComponent.unpinTelemetryNavigatorTimestamp(firstPin.timestamp);
      expect(secondComponent.isTelemetryNavigatorPinned(firstPin)).toBeFalse();
      expect(secondComponent.getPinnedTelemetryNavigatorPoints().length).toBe(1);

      const persistedPins = JSON.parse(localStorage.getItem('ri-action-telemetry-pins-v1') || '[]') as number[];
      expect(persistedPins).toEqual([secondPin.timestamp]);
      done();
    }, 100);
  });

  it('should support pinned-only filter mode and expose pinned metadata labels', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 70 }, (_, index) => ({
      timestamp: now - ((69 - index) * 30 * 60 * 1000),
      openCount: Math.max(70 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 10, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const pinA = secondComponent.adoptionTelemetry[15];
      const pinB = secondComponent.adoptionTelemetry[30];
      secondComponent.toggleTelemetryNavigatorPin(pinA);
      secondComponent.toggleTelemetryNavigatorPin(pinB);

      const defaultNavigator = secondComponent.getTelemetryNavigatorPoints();
      expect(defaultNavigator.length).toBeGreaterThan(0);

      secondComponent.toggleTelemetryNavigatorPinnedOnlyMode();
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeTrue();
      const pinnedOnly = secondComponent.getTelemetryNavigatorPoints();
      expect(pinnedOnly.length).toBe(2);
      expect(pinnedOnly.every((point) => secondComponent.isTelemetryNavigatorPinned(point))).toBeTrue();

      const ageLabel = secondComponent.getPinnedSnapshotAgeLabel(pinA.timestamp);
      const contextLabel = secondComponent.getPinnedSnapshotContextLabel(pinA);
      expect(ageLabel).toContain('Age ');
      expect(['within window', 'outside window']).toContain(contextLabel);

      secondComponent.clearTelemetryNavigatorPins();
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeFalse();
      done();
    }, 100);
  });

  it('should persist and restore telemetry navigator preferences', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 65 }, (_, index) => ({
      timestamp: now - ((64 - index) * 30 * 60 * 1000),
      openCount: Math.max(65 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 5, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));
    localStorage.setItem('ri-action-telemetry-pins-v1', JSON.stringify([seed[10].timestamp]));
    localStorage.setItem('ri-action-telemetry-navigator-prefs-v1', JSON.stringify({
      continuousMode: true,
      sortOrder: 'oldest',
      pageSize: 15,
      minRate: 42,
      pinnedOnlyMode: true,
    }));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      expect(secondComponent.telemetryNavigatorContinuousMode).toBeTrue();
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('oldest');
      expect(secondComponent.telemetryNavigatorPageSize).toBe(15);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(42);
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeTrue();

      secondComponent.toggleTelemetryNavigatorContinuousMode();
      secondComponent.toggleTelemetryNavigatorSortOrder();
      secondComponent.setTelemetryNavigatorPageSize(5);
      secondComponent.setTelemetryNavigatorMinRate(66);
      secondComponent.toggleTelemetryNavigatorPinnedOnlyMode();

      const persisted = JSON.parse(localStorage.getItem('ri-action-telemetry-navigator-prefs-v1') || '{}') as {
        continuousMode: boolean;
        sortOrder: string;
        pageSize: number;
        minRate: number;
        pinnedOnlyMode: boolean;
      };

      expect(persisted.continuousMode).toBeFalse();
      expect(persisted.sortOrder).toBe('newest');
      expect(persisted.pageSize).toBe(5);
      expect(persisted.minRate).toBe(66);
      expect(persisted.pinnedOnlyMode).toBeFalse();

      secondComponent.setTelemetryWindow('7d');
      const persistedAfterWindowReset = JSON.parse(localStorage.getItem('ri-action-telemetry-navigator-prefs-v1') || '{}') as {
        continuousMode: boolean;
        sortOrder: string;
        pageSize: number;
        minRate: number;
        pinnedOnlyMode: boolean;
      };

      expect(secondComponent.telemetryNavigatorContinuousMode).toBeFalse();
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('newest');
      expect(secondComponent.telemetryNavigatorMinRate).toBe(0);
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeFalse();
      expect(persistedAfterWindowReset.continuousMode).toBeFalse();
      expect(persistedAfterWindowReset.sortOrder).toBe('newest');
      expect(persistedAfterWindowReset.minRate).toBe(0);
      expect(persistedAfterWindowReset.pinnedOnlyMode).toBeFalse();
      done();
    }, 100);
  });

  it('should reset telemetry navigator preferences to defaults and persist them', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 50 }, (_, index) => ({
      timestamp: now - ((49 - index) * 30 * 60 * 1000),
      openCount: Math.max(50 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 10, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));
    localStorage.setItem('ri-action-telemetry-pins-v1', JSON.stringify([seed[8].timestamp]));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.toggleTelemetryNavigatorContinuousMode();
      secondComponent.toggleTelemetryNavigatorSortOrder();
      secondComponent.setTelemetryNavigatorPageSize(15);
      secondComponent.setTelemetryNavigatorMinRate(55);
      secondComponent.toggleTelemetryNavigatorPinnedOnlyMode();

      expect(secondComponent.telemetryNavigatorContinuousMode).toBeTrue();
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('oldest');
      expect(secondComponent.telemetryNavigatorPageSize).toBe(15);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(55);
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeTrue();

      secondComponent.resetTelemetryNavigatorPreferences();

      expect(secondComponent.telemetryNavigatorContinuousMode).toBeFalse();
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('newest');
      expect(secondComponent.telemetryNavigatorPageSize).toBe(8);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(0);
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeFalse();
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);

      const persisted = JSON.parse(localStorage.getItem('ri-action-telemetry-navigator-prefs-v1') || '{}') as {
        continuousMode: boolean;
        sortOrder: string;
        pageSize: number;
        minRate: number;
        pinnedOnlyMode: boolean;
      };

      expect(persisted.continuousMode).toBeFalse();
      expect(persisted.sortOrder).toBe('newest');
      expect(persisted.pageSize).toBe(8);
      expect(persisted.minRate).toBe(0);
      expect(persisted.pinnedOnlyMode).toBeFalse();
      done();
    }, 100);
  });

  it('should apply telemetry navigator presets and persist resulting preferences', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 55 }, (_, index) => ({
      timestamp: now - ((54 - index) * 30 * 60 * 1000),
      openCount: Math.max(55 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(index + 20, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.applyTelemetryNavigatorPreset('focus');
      expect(secondComponent.telemetryNavigatorContinuousMode).toBeFalse();
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('newest');
      expect(secondComponent.telemetryNavigatorPageSize).toBe(5);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(60);
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeFalse();
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);

      const persistedFocus = JSON.parse(localStorage.getItem('ri-action-telemetry-navigator-prefs-v1') || '{}') as {
        continuousMode: boolean;
        sortOrder: string;
        pageSize: number;
        minRate: number;
        pinnedOnlyMode: boolean;
      };

      expect(persistedFocus.continuousMode).toBeFalse();
      expect(persistedFocus.sortOrder).toBe('newest');
      expect(persistedFocus.pageSize).toBe(5);
      expect(persistedFocus.minRate).toBe(60);
      expect(persistedFocus.pinnedOnlyMode).toBeFalse();

      secondComponent.applyTelemetryNavigatorPreset('explore');
      expect(secondComponent.telemetryNavigatorContinuousMode).toBeTrue();
      expect(secondComponent.telemetryNavigatorSortOrder).toBe('oldest');
      expect(secondComponent.telemetryNavigatorPageSize).toBe(15);
      expect(secondComponent.telemetryNavigatorMinRate).toBe(0);
      expect(secondComponent.telemetryNavigatorPinnedOnlyMode).toBeFalse();
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);

      const persistedExplore = JSON.parse(localStorage.getItem('ri-action-telemetry-navigator-prefs-v1') || '{}') as {
        continuousMode: boolean;
        sortOrder: string;
        pageSize: number;
        minRate: number;
        pinnedOnlyMode: boolean;
      };

      expect(persistedExplore.continuousMode).toBeTrue();
      expect(persistedExplore.sortOrder).toBe('oldest');
      expect(persistedExplore.pageSize).toBe(15);
      expect(persistedExplore.minRate).toBe(0);
      expect(persistedExplore.pinnedOnlyMode).toBeFalse();
      done();
    }, 100);
  });

  it('should export the current telemetry window as CSV', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (2 * 30 * 60 * 1000), openCount: 5, inProgressCount: 1, completedCount: 2, adoptionRate: 30 },
      { timestamp: now - (1 * 30 * 60 * 1000), openCount: 4, inProgressCount: 1, completedCount: 3, adoptionRate: 40 },
      { timestamp: now, openCount: 3, inProgressCount: 1, completedCount: 4, adoptionRate: 50 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');

      let capturedBlob: Blob | null = null;
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
      const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.callFake((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:telemetry';
      });
      const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL').and.stub();
      const appendChildSpy = spyOn(document.body, 'appendChild').and.callThrough();
      const removeChildSpy = spyOn(document.body, 'removeChild').and.callThrough();

      secondComponent.exportTelemetryWindowCsv();

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:telemetry');
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(capturedBlob).toBeTruthy();

      capturedBlob!.text().then((csvText) => {
        const [header, firstRow] = csvText.split('\n');
        expect(header).toBe('timestamp_iso,timestamp_ms,adoption_rate,completed_count,in_progress_count,open_count');
        expect(firstRow).toContain(',');
        expect(csvText).toContain('adoption_rate');
        done();
      });
    }, 100);
  });

  it('should support keyboard shortcuts for telemetry navigation and ignore typing contexts', (done) => {
    const now = Date.now();
    const seed = Array.from({ length: 50 }, (_, index) => ({
      timestamp: now - ((49 - index) * 30 * 60 * 1000),
      openCount: Math.max(50 - index, 0),
      inProgressCount: index % 4,
      completedCount: index,
      adoptionRate: Math.min(10 + index, 100),
    }));

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      secondComponent.setTelemetryWindow('1h');
      secondComponent.setTelemetryZoom(4);

      const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
      const leftPreventDefaultSpy = spyOn(leftEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(leftEvent);
      expect(secondComponent.telemetryPanOffsetSteps).toBe(1);
      expect(leftPreventDefaultSpy).toHaveBeenCalled();

      const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight' });
      const rightPreventDefaultSpy = spyOn(rightEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(rightEvent);
      expect(secondComponent.telemetryPanOffsetSteps).toBe(0);
      expect(rightPreventDefaultSpy).toHaveBeenCalled();

      const jumpOlderEvent = new KeyboardEvent('keydown', { key: 'j' });
      const jumpOlderPreventDefaultSpy = spyOn(jumpOlderEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(jumpOlderEvent);
      expect(secondComponent.telemetryNavigatorOffset).toBeGreaterThan(0);
      expect(jumpOlderPreventDefaultSpy).toHaveBeenCalled();

      const jumpNewerEvent = new KeyboardEvent('keydown', { key: 'k' });
      const jumpNewerPreventDefaultSpy = spyOn(jumpNewerEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(jumpNewerEvent);
      expect(secondComponent.telemetryNavigatorOffset).toBe(0);
      expect(jumpNewerPreventDefaultSpy).toHaveBeenCalled();

      const olderPoint = secondComponent.getTelemetryNavigatorPoints()[2];
      expect(olderPoint).toBeTruthy();
      secondComponent.focusTelemetryPoint(olderPoint);
      expect(secondComponent.canRecenterTelemetryToLiveEdge()).toBeTrue();

      const liveEvent = new KeyboardEvent('keydown', { key: 'l' });
      const livePreventDefaultSpy = spyOn(liveEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(liveEvent);
      expect(secondComponent.telemetryPanOffsetSteps).toBe(0);
      expect(secondComponent.canRecenterTelemetryToLiveEdge()).toBeFalse();
      expect(livePreventDefaultSpy).toHaveBeenCalled();

      const typingContextEvent = {
        key: 'ArrowLeft',
        target: document.createElement('input'),
        preventDefault: jasmine.createSpy('preventDefault'),
      } as unknown as KeyboardEvent;

      secondComponent.handleTelemetryKeyboardShortcut(typingContextEvent);
      expect(secondComponent.telemetryPanOffsetSteps).toBe(0);
      expect(typingContextEvent.preventDefault).not.toHaveBeenCalled();

      const helpEvent = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
      const helpPreventDefaultSpy = spyOn(helpEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(helpEvent);
      expect(secondComponent.telemetryShortcutHelpOpen).toBeTrue();
      expect(helpPreventDefaultSpy).toHaveBeenCalled();

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      const escapePreventDefaultSpy = spyOn(escapeEvent, 'preventDefault');
      secondComponent.handleTelemetryKeyboardShortcut(escapeEvent);
      expect(secondComponent.telemetryShortcutHelpOpen).toBeFalse();
      expect(escapePreventDefaultSpy).toHaveBeenCalled();

      const helpTypingContextEvent = {
        key: '?',
        shiftKey: true,
        target: document.createElement('input'),
        preventDefault: jasmine.createSpy('preventDefault'),
      } as unknown as KeyboardEvent;

      secondComponent.handleTelemetryKeyboardShortcut(helpTypingContextEvent);
      expect(secondComponent.telemetryShortcutHelpOpen).toBeFalse();
      expect(helpTypingContextEvent.preventDefault).not.toHaveBeenCalled();
      done();
    }, 100);
  });

  it('should compute signed adoption deltas for telemetry navigator snapshots', (done) => {
    const now = Date.now();
    const seed = [
      { timestamp: now - (4 * 30 * 60 * 1000), openCount: 8, inProgressCount: 1, completedCount: 1, adoptionRate: 20 },
      { timestamp: now - (3 * 30 * 60 * 1000), openCount: 7, inProgressCount: 2, completedCount: 1, adoptionRate: 30 },
      { timestamp: now - (2 * 30 * 60 * 1000), openCount: 6, inProgressCount: 2, completedCount: 2, adoptionRate: 25 },
      { timestamp: now - (1 * 30 * 60 * 1000), openCount: 5, inProgressCount: 2, completedCount: 3, adoptionRate: 40 },
      { timestamp: now, openCount: 4, inProgressCount: 2, completedCount: 4, adoptionRate: 35 },
    ];

    localStorage.setItem('ri-action-telemetry-v1', JSON.stringify(seed));

    const secondFixture = TestBed.createComponent(ActionsComponent);
    const secondComponent = secondFixture.componentInstance;
    secondFixture.detectChanges();

    setTimeout(() => {
      const firstPoint = secondComponent.adoptionTelemetry.find((point) => point.timestamp === seed[0].timestamp);
      const risingPoint = secondComponent.adoptionTelemetry.find((point) => point.timestamp === seed[3].timestamp);
      const fallingPoint = secondComponent.adoptionTelemetry.find((point) => point.timestamp === seed[4].timestamp);

      expect(firstPoint).toBeTruthy();
      expect(risingPoint).toBeTruthy();
      expect(fallingPoint).toBeTruthy();

      expect(secondComponent.getTelemetryNavigatorDelta(firstPoint!)).toBe(0);
      expect(secondComponent.formatTelemetryNavigatorDelta(firstPoint!)).toBe('0%');

      expect(secondComponent.getTelemetryNavigatorDelta(risingPoint!)).toBe(15);
      expect(secondComponent.formatTelemetryNavigatorDelta(risingPoint!)).toBe('+15%');

      expect(secondComponent.getTelemetryNavigatorDelta(fallingPoint!)).toBe(-5);
      expect(secondComponent.formatTelemetryNavigatorDelta(fallingPoint!)).toBe('-5%');
      done();
    }, 100);
  });
});
