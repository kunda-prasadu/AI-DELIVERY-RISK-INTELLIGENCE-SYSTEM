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
      expect(pagedPoints.length).toBe(8);

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
