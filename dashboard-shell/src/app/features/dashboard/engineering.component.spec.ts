import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EngineeringComponent } from './engineering.component';
import { ProjectsService } from '../../shared/services/projects.service';
import { RiskService } from '../../shared/services/risk.service';
import { AgentWorkbenchService } from '../../shared/services/agent-workbench.service';
import { FeedbackService } from '../../shared/services/feedback.service';
import { AuthService } from '../../shared/services/auth.service';

describe('EngineeringComponent', () => {
  let projectsServiceSpy: jasmine.SpyObj<ProjectsService>;
  let riskServiceSpy: jasmine.SpyObj<RiskService>;
  let agentWorkbenchServiceSpy: jasmine.SpyObj<AgentWorkbenchService>;
  let feedbackServiceSpy: jasmine.SpyObj<FeedbackService>;
  const authServiceStub = {
    user$: of({ id: 'test-user', email: 'test@example.com', role: 'admin' } as any),
  };

  beforeEach(async () => {
    projectsServiceSpy = jasmine.createSpyObj<ProjectsService>('ProjectsService', ['getProjects']);
    riskServiceSpy = jasmine.createSpyObj<RiskService>('RiskService', ['refreshRiskScores', 'getPortfolioAnomalies', 'getPortfolioAnomalySummary']);
    agentWorkbenchServiceSpy = jasmine.createSpyObj<AgentWorkbenchService>('AgentWorkbenchService', ['getProjectAgentWorkbench']);
    feedbackServiceSpy = jasmine.createSpyObj<FeedbackService>('FeedbackService', ['getLearning', 'submit']);
    agentWorkbenchServiceSpy.getProjectAgentWorkbench.and.returnValue(
      of({
        workbench: {
          projectId: 'p1',
          projectName: 'Payments Gateway',
          team: 'Core Platform',
          status: 'active',
          riskScore: 88,
          band: 'CRITICAL',
          generatedAt: new Date().toISOString(),
          agents: [
            { key: 'data-ingestion', name: 'Data Ingestion Agent', status: 'ACTIVE', summary: { eventCount: 16, pipelineHealth: 'streaming' } },
            { key: 'risk-detection', name: 'Risk Detection Agent', status: 'ACTIVE', summary: { totalInsights: 4, criticalInsights: 2 } },
            { key: 'recommendation', name: 'Recommendation Agent', status: 'ACTIVE', summary: { totalRecommendations: 4, p1Recommendations: 2 } },
            { key: 'feedback-learning', name: 'Feedback Learning Agent', status: 'READY', summary: { loopState: 'feedback-enabled' } },
          ],
          summaries: {
            insights: {
              totalInsights: 4,
              severityCounts: { INFO: 1, WARNING: 1, CRITICAL: 2 },
              domainCounts: { overall: 1, cicd: 2, quality: 1 },
            },
            recommendations: {
              totalRecommendations: 4,
              priorityCounts: { P1: 2, P2: 1, P3: 1 },
              ownerRoleCounts: { 'DevOps Lead': 2, 'QA Lead': 1, 'Program Manager': 1 },
              domainCounts: { overall: 1, cicd: 2, quality: 1 },
            },
          },
          previews: {
            insights: [
              {
                id: 'SUMMARY',
                domain: 'overall',
                severity: 'CRITICAL',
                title: 'Overall risk: CRITICAL',
                detail: 'Aggregate risk score is critical.',
                action: 'Review flagged signals.',
              },
            ],
            recommendations: [
              {
                id: 'REC-SUMMARY-1',
                projectId: 'p1',
                priority: 'P1',
                domain: 'overall',
                ownerRole: 'Program Manager',
                title: 'Review flagged signals',
                description: 'Assign owners to remediation actions.',
                rationale: 'Aggregate risk score is critical.',
                sourceInsightIds: ['SUMMARY'],
                confidence: 91,
                status: 'OPEN',
              },
            ],
          },
          nextActions: [
            {
              id: 'REC-SUMMARY-1',
              priority: 'P1',
              ownerRole: 'Program Manager',
              title: 'Review flagged signals',
              description: 'Assign owners to remediation actions.',
            },
          ],
        },
      } as any)
    );
    feedbackServiceSpy.getLearning.and.returnValue(
      of({
        learning: {
          total: 0,
          signalCounts: { accepted: 0, rejected: 0, deferred: 0, corrected: 0 },
          acceptanceRate: 0,
          rejectionRate: 0,
          byTargetType: { recommendation: { total: 0, accepted: 0, rejected: 0 }, insight: { total: 0, accepted: 0, rejected: 0 }, anomaly: { total: 0, accepted: 0, rejected: 0 }, report: { total: 0, accepted: 0, rejected: 0 } },
          corrections: [],
          topRejected: [],
          generatedAt: new Date().toISOString(),
        },
      })
    );

    await TestBed.configureTestingModule({
      imports: [EngineeringComponent],
      providers: [
        { provide: ProjectsService, useValue: projectsServiceSpy },
        { provide: RiskService, useValue: riskServiceSpy },
        { provide: AgentWorkbenchService, useValue: agentWorkbenchServiceSpy },
        { provide: FeedbackService, useValue: feedbackServiceSpy },
        { provide: AuthService, useValue: authServiceStub },
      ],
    }).compileComponents();
  });

  it('should compute engineering metrics and render hotspot sections', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [
          { id: 'p1', name: 'Payments Gateway', team: 'Core Platform', description: '', status: 'active' },
          { id: 'p2', name: 'IAM Platform', team: 'Identity', description: '', status: 'active' },
          { id: 'p3', name: 'Data Platform', team: 'Data', description: '', status: 'active' },
        ],
        total: 3,
      } as any)
    );

    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Payments Gateway',
          score: 88,
          band: 'CRITICAL',
          signals: { codeVelocity: 73, quality: 58, cicd: 52, jiraVelocity: 70 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p2',
          projectName: 'IAM Platform',
          score: 61,
          band: 'HIGH',
          signals: { codeVelocity: 62, quality: 66, cicd: 59, jiraVelocity: 68 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p3',
          projectName: 'Data Platform',
          score: 29,
          band: 'LOW',
          signals: { codeVelocity: 44, quality: 39, cicd: 48, jiraVelocity: 55 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );

    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p1',
          severity: 'CRITICAL',
          anomalyScore: 94,
          trend: 'regression',
          reasons: ['Critical trend is regressing compared to previous snapshot'],
          metrics: {
            totalEvents: 16,
            severityCounts: { low: 2, medium: 4, high: 5, critical: 5 },
            latestEventAt: new Date().toISOString(),
          },
        },
        {
          projectId: 'p2',
          severity: 'HIGH',
          anomalyScore: 80,
          trend: 'watch',
          reasons: ['High severity events are rising'],
          metrics: {
            totalEvents: 11,
            severityCounts: { low: 2, medium: 3, high: 4, critical: 2 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );

    riskServiceSpy.getPortfolioAnomalySummary.and.returnValue(
      of({
        totalProjects: 3,
        criticalCount: 1,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        escalatedCount: 1,
        topAnomalies: [
          {
            projectId: 'p1',
            severity: 'CRITICAL',
            anomalyScore: 94,
            trend: 'regression',
          },
        ],
      } as any)
    );

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.hotspots.length).toBe(3);
    expect(component.highRiskCount).toBe(2);
    expect(component.regressionCount).toBe(1);
    expect(component.criticalEventCount).toBe(7);
    expect(component.deliveryPressure).toBe(59);
    expect(component.modelHealthIndex).toBeLessThan(100);
    expect(component.escalatedSignalRatio).toBe(33);

    expect(compiled.textContent).toContain('Top Hotspot Repositories');
    expect(compiled.textContent).toContain('Reliability Watchlist');
    expect(compiled.textContent).toContain('Quality Drift Radar');
    expect(compiled.textContent).toContain('Multi-Agent Workbench');
    expect(compiled.textContent).toContain('Recommendation Agent');
    expect(compiled.textContent).toContain('Payments Gateway');
    expect(agentWorkbenchServiceSpy.getProjectAgentWorkbench).toHaveBeenCalledWith('p1', { insightLimit: 3, recommendationLimit: 3 });
  });

  it('should order hotspots by weighted pressure score', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [
          { id: 'p1', name: 'A', team: 'Team A', description: '', status: 'active' },
          { id: 'p2', name: 'B', team: 'Team B', description: '', status: 'active' },
        ],
        total: 2,
      } as any)
    );

    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'A',
          score: 55,
          band: 'HIGH',
          signals: { codeVelocity: 60, quality: 49, cicd: 60, jiraVelocity: 58 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p2',
          projectName: 'B',
          score: 48,
          band: 'LOW',
          signals: { codeVelocity: 40, quality: 35, cicd: 42, jiraVelocity: 41 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );

    riskServiceSpy.getPortfolioAnomalies.and.returnValue(
      of([
        {
          projectId: 'p1',
          severity: 'HIGH',
          anomalyScore: 71,
          trend: 'watch',
          reasons: ['High severity pressure'],
          metrics: {
            totalEvents: 7,
            severityCounts: { low: 1, medium: 2, high: 3, critical: 1 },
            latestEventAt: new Date().toISOString(),
          },
        },
      ] as any)
    );

    riskServiceSpy.getPortfolioAnomalySummary.and.returnValue(
      of({
        totalProjects: 2,
        criticalCount: 0,
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        escalatedCount: 1,
        topAnomalies: [],
      } as any)
    );

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;

    expect(component.hotspots[0].projectId).toBe('p1');
    expect(component.hotspots[1].projectId).toBe('p2');
  });

  it('should fall back to empty state when services fail', () => {
    projectsServiceSpy.getProjects.and.returnValue(throwError(() => new Error('projects failure')));
    riskServiceSpy.refreshRiskScores.and.returnValue(throwError(() => new Error('risk failure')));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(throwError(() => new Error('anomaly failure')));
    riskServiceSpy.getPortfolioAnomalySummary.and.returnValue(throwError(() => new Error('summary failure')));

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;

    expect(component.loading).toBeFalse();
    expect(component.hotspots.length).toBe(0);
    expect(component.deliveryPressure).toBe(0);
    expect(agentWorkbenchServiceSpy.getProjectAgentWorkbench).not.toHaveBeenCalled();
    expect(compiled.textContent).toContain('No engineering insights are available yet.');
  });

  it('should initialize feedback panel defaults', () => {
    projectsServiceSpy.getProjects.and.returnValue(of({ projects: [], total: 0 } as any));
    riskServiceSpy.refreshRiskScores.and.returnValue(of([] as any));
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([] as any));
    riskServiceSpy.getPortfolioAnomalySummary.and.returnValue(of({ totalProjects: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, escalatedCount: 0, topAnomalies: [] } as any));

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.feedbackTargetType).toBe('recommendation');
    expect(component.feedbackSignal).toBe('accepted');
    expect(component.feedbackSubmitting).toBeFalse();
    expect(feedbackServiceSpy.getLearning).toHaveBeenCalled();
  });

  it('should switch the focused agent workbench project on demand', () => {
    projectsServiceSpy.getProjects.and.returnValue(
      of({
        projects: [
          { id: 'p1', name: 'Payments Gateway', team: 'Core Platform', description: '', status: 'active' },
          { id: 'p2', name: 'IAM Platform', team: 'Identity', description: '', status: 'active' },
        ],
        total: 2,
      } as any)
    );
    riskServiceSpy.refreshRiskScores.and.returnValue(
      of([
        {
          projectId: 'p1',
          projectName: 'Payments Gateway',
          score: 88,
          band: 'CRITICAL',
          signals: { codeVelocity: 73, quality: 58, cicd: 52, jiraVelocity: 70 },
          lastUpdated: new Date().toISOString(),
        },
        {
          projectId: 'p2',
          projectName: 'IAM Platform',
          score: 61,
          band: 'HIGH',
          signals: { codeVelocity: 62, quality: 66, cicd: 59, jiraVelocity: 68 },
          lastUpdated: new Date().toISOString(),
        },
      ] as any)
    );
    riskServiceSpy.getPortfolioAnomalies.and.returnValue(of([] as any));
    riskServiceSpy.getPortfolioAnomalySummary.and.returnValue(
      of({ totalProjects: 2, criticalCount: 1, highCount: 1, mediumCount: 0, lowCount: 0, escalatedCount: 1, topAnomalies: [] } as any)
    );

    agentWorkbenchServiceSpy.getProjectAgentWorkbench.and.returnValues(
      of({
        workbench: {
          projectId: 'p1',
          projectName: 'Payments Gateway',
          team: 'Core Platform',
          status: 'active',
          riskScore: 88,
          band: 'CRITICAL',
          generatedAt: new Date().toISOString(),
          agents: [],
          summaries: {
            insights: { totalInsights: 3, severityCounts: { INFO: 0, WARNING: 1, CRITICAL: 2 }, domainCounts: { overall: 1 } },
            recommendations: { totalRecommendations: 2, priorityCounts: { P1: 2, P2: 0, P3: 0 }, ownerRoleCounts: {}, domainCounts: {} },
          },
          previews: { insights: [], recommendations: [] },
          nextActions: [],
        },
      } as any),
      of({
        workbench: {
          projectId: 'p2',
          projectName: 'IAM Platform',
          team: 'Identity',
          status: 'active',
          riskScore: 61,
          band: 'HIGH',
          generatedAt: new Date().toISOString(),
          agents: [],
          summaries: {
            insights: { totalInsights: 2, severityCounts: { INFO: 0, WARNING: 2, CRITICAL: 0 }, domainCounts: { quality: 1 } },
            recommendations: { totalRecommendations: 1, priorityCounts: { P1: 0, P2: 1, P3: 0 }, ownerRoleCounts: {}, domainCounts: {} },
          },
          previews: { insights: [], recommendations: [] },
          nextActions: [],
        },
      } as any)
    );

    const fixture = TestBed.createComponent(EngineeringComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.selectWorkbenchProject('p2');

    expect(agentWorkbenchServiceSpy.getProjectAgentWorkbench).toHaveBeenCalledWith('p2', { insightLimit: 3, recommendationLimit: 3 });
    expect(component.selectedWorkbenchProjectId).toBe('p2');
    expect(component.agentWorkbench?.projectId).toBe('p2');
  });
});
