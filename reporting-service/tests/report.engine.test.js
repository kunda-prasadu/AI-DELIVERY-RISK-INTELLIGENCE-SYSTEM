'use strict';

const {
  ragStatus,
  buildPortfolioHealth,
  buildTopRisks,
  buildExecutiveSummary,
  renderMarkdown,
  generateReport,
  REPORT_TYPES,
} = require('../src/models/report.engine');

describe('report.engine', () => {
  describe('ragStatus', () => {
    it('returns RED for score >= 70', () => {
      expect(ragStatus(70)).toBe('RED');
      expect(ragStatus(95)).toBe('RED');
    });

    it('returns AMBER for score 40-69', () => {
      expect(ragStatus(40)).toBe('AMBER');
      expect(ragStatus(69)).toBe('AMBER');
    });

    it('returns GREEN for score < 40', () => {
      expect(ragStatus(0)).toBe('GREEN');
      expect(ragStatus(39)).toBe('GREEN');
    });
  });

  describe('buildPortfolioHealth', () => {
    const projects = [
      { id: 'p1', name: 'Alpha', riskScore: 80 },
      { id: 'p2', name: 'Beta', riskScore: 50 },
      { id: 'p3', name: 'Gamma', riskScore: 20 },
    ];

    it('counts totals and at-risk correctly', () => {
      const h = buildPortfolioHealth(projects);
      expect(h.totalProjects).toBe(3);
      expect(h.atRisk).toBe(2); // RED + AMBER
      expect(h.onTrack).toBe(1);
      expect(h.ragBreakdown.RED).toBe(1);
      expect(h.ragBreakdown.AMBER).toBe(1);
      expect(h.ragBreakdown.GREEN).toBe(1);
    });

    it('handles empty list', () => {
      const h = buildPortfolioHealth([]);
      expect(h.totalProjects).toBe(0);
      expect(h.atRisk).toBe(0);
    });
  });

  describe('buildTopRisks', () => {
    it('returns top-5 sorted by riskScore descending', () => {
      const projects = Array.from({ length: 7 }, (_, i) => ({
        id: `p${i}`,
        name: `Project ${i}`,
        riskScore: i * 10,
      }));
      const top = buildTopRisks(projects);
      expect(top).toHaveLength(5);
      expect(top[0].riskScore).toBe(60);
    });

    it('includes rag field', () => {
      const top = buildTopRisks([{ id: 'p1', name: 'X', riskScore: 75 }]);
      expect(top[0].rag).toBe('RED');
    });
  });

  describe('buildExecutiveSummary', () => {
    it('computes average risk and overall rag', () => {
      const projects = [
        { id: 'p1', name: 'A', riskScore: 80 },
        { id: 'p2', name: 'B', riskScore: 60 },
      ];
      const s = buildExecutiveSummary({ projects, openInsights: 5, openRecommendations: 3, anomalyCount: 2 });
      expect(s.averageRiskScore).toBe(70);
      expect(s.overallRag).toBe('RED');
      expect(s.openInsights).toBe(5);
      expect(s.openRecommendations).toBe(3);
      expect(s.anomalyCount).toBe(2);
    });
  });

  describe('renderMarkdown', () => {
    it('includes report type header and decision fields', () => {
      const report = generateReport({
        reportType: 'executive-summary',
        requestedBy: 'test-user',
        projects: [{ id: 'p1', name: 'Alpha', riskScore: 80, status: 'at-risk' }],
        openInsights: 4,
      });
      expect(report.markdown).toContain('Executive Report — executive-summary');
      expect(report.markdown).toContain('test-user');
      expect(report.markdown).toContain('Alpha');
    });
  });

  describe('generateReport', () => {
    it('assigns a reportId and generatedAt', () => {
      const r = generateReport();
      expect(r.reportId).toBeDefined();
      expect(r.generatedAt).toBeDefined();
    });

    it('includes sections.executiveSummary and sections.topRisks', () => {
      const r = generateReport({ projects: [{ id: 'p1', name: 'X', riskScore: 50 }] });
      expect(r.sections.executiveSummary).toBeDefined();
      expect(Array.isArray(r.sections.topRisks)).toBe(true);
    });

    it('defaults reportType to executive-summary', () => {
      const r = generateReport();
      expect(r.reportType).toBe('executive-summary');
    });

    it('REPORT_TYPES contains all expected types', () => {
      expect(REPORT_TYPES).toEqual(
        expect.arrayContaining(['executive-summary', 'risk-deep-dive', 'portfolio-health'])
      );
    });
  });
});
