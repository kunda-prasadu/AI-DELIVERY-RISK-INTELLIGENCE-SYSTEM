'use strict';

const { generateInsights, INSIGHT_RULES } = require('../src/models/insights.engine');

describe('generateInsights', () => {
  test('always includes a SUMMARY insight', () => {
    const insights = generateInsights('proj-001', { codeVelocity: 10, quality: 10, cicd: 10, jiraVelocity: 10 }, 'LOW');
    const summary = insights.find(i => i.id === 'SUMMARY');
    expect(summary).toBeDefined();
    expect(summary.domain).toBe('overall');
  });

  test('SUMMARY severity is INFO for LOW band', () => {
    const insights = generateInsights('proj-001', { codeVelocity: 5, quality: 5, cicd: 5, jiraVelocity: 5 }, 'LOW');
    expect(insights.find(i => i.id === 'SUMMARY').severity).toBe('INFO');
  });

  test('SUMMARY severity is CRITICAL for CRITICAL band', () => {
    const insights = generateInsights('proj-003', { codeVelocity: 90, quality: 90, cicd: 90, jiraVelocity: 90 }, 'CRITICAL');
    expect(insights.find(i => i.id === 'SUMMARY').severity).toBe('CRITICAL');
  });

  test('triggers CV-001 when codeVelocity >= 70', () => {
    const insights = generateInsights('p', { codeVelocity: 80, quality: 10, cicd: 10, jiraVelocity: 10 }, 'HIGH');
    expect(insights.some(i => i.id === 'CV-001')).toBe(true);
  });

  test('does NOT trigger CV-001 when codeVelocity < 70', () => {
    const insights = generateInsights('p', { codeVelocity: 30, quality: 10, cicd: 10, jiraVelocity: 10 }, 'LOW');
    expect(insights.some(i => i.id === 'CV-001')).toBe(false);
  });

  test('triggers CICD-001 when cicd >= 60', () => {
    const insights = generateInsights('p', { codeVelocity: 10, quality: 10, cicd: 75, jiraVelocity: 10 }, 'HIGH');
    expect(insights.some(i => i.id === 'CICD-001')).toBe(true);
  });

  test('no duplicate insight ids', () => {
    const insights = generateInsights('p', { codeVelocity: 85, quality: 70, cicd: 80, jiraVelocity: 75 }, 'CRITICAL');
    const ids = insights.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all insights have required fields', () => {
    const insights = generateInsights('p', { codeVelocity: 50, quality: 50, cicd: 50, jiraVelocity: 50 }, 'HIGH');
    for (const ins of insights) {
      expect(ins.id).toBeTruthy();
      expect(ins.domain).toBeTruthy();
      expect(ins.severity).toBeTruthy();
      expect(ins.title).toBeTruthy();
      expect(ins.detail).toBeTruthy();
      expect(ins.action).toBeTruthy();
    }
  });
});

describe('INSIGHT_RULES', () => {
  test('all rules have required fields', () => {
    for (const rule of INSIGHT_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.domain).toBeTruthy();
      expect(typeof rule.trigger).toBe('function');
      expect(rule.severity).toMatch(/^(INFO|WARNING|CRITICAL)$/);
    }
  });
});
