'use strict';

const {
  generateRecommendations,
  summarizeRecommendations,
} = require('../src/models/recommendation.engine');

describe('Recommendation Engine', () => {
  const riskScore = {
    score: 74,
    band: 'HIGH',
  };

  const insights = [
    {
      id: 'SUMMARY',
      domain: 'overall',
      severity: 'WARNING',
      title: 'Overall risk is high',
      detail: 'Aggregate score indicates delivery pressure.',
      action: 'Review portfolio-level mitigations.',
    },
    {
      id: 'CICD-001',
      domain: 'cicd',
      severity: 'CRITICAL',
      title: 'CI/CD instability',
      detail: 'Pipeline failures are increasing.',
      action: 'Stabilize build and rollout steps.',
    },
  ];

  test('generates one recommendation per insight', () => {
    const recommendations = generateRecommendations('proj-001', riskScore, insights);
    expect(recommendations.length).toBe(insights.length);
  });

  test('assigns priorities by insight severity', () => {
    const recommendations = generateRecommendations('proj-001', riskScore, insights);
    const priorities = recommendations.map(r => r.priority);
    expect(priorities).toContain('P1');
    expect(priorities).toContain('P2');
  });

  test('assigns owner role by domain', () => {
    const recommendations = generateRecommendations('proj-001', riskScore, insights);
    const cicdRecommendation = recommendations.find(r => r.domain === 'cicd');
    expect(cicdRecommendation.ownerRole).toBe('DevOps Lead');
  });

  test('returns empty array when insights missing', () => {
    expect(generateRecommendations('proj-001', riskScore, null)).toEqual([]);
  });

  test('sorts recommendations by priority rank', () => {
    const recommendations = generateRecommendations('proj-001', riskScore, insights);
    const rank = { P1: 1, P2: 2, P3: 3 };
    for (let i = 1; i < recommendations.length; i++) {
      expect(rank[recommendations[i - 1].priority]).toBeLessThanOrEqual(rank[recommendations[i].priority]);
    }
  });

  test('summary returns counts by priority, ownerRole and domain', () => {
    const recommendations = generateRecommendations('proj-001', riskScore, insights);
    const summary = summarizeRecommendations(recommendations);

    expect(summary.totalRecommendations).toBe(2);
    expect(summary.priorityCounts.P1).toBeGreaterThanOrEqual(1);
    expect(summary.ownerRoleCounts['DevOps Lead']).toBeGreaterThanOrEqual(1);
    expect(summary.domainCounts.cicd).toBeGreaterThanOrEqual(1);
  });
});
