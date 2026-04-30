'use strict';

const { aggregateLearningData } = require('../src/models/learning.engine');

describe('learning.engine', () => {
  const entries = [
    { feedbackId: 'f1', projectId: 'p1', targetType: 'recommendation', targetId: 'r1', signal: 'accepted', createdAt: new Date().toISOString() },
    { feedbackId: 'f2', projectId: 'p1', targetType: 'recommendation', targetId: 'r2', signal: 'rejected', createdAt: new Date().toISOString() },
    { feedbackId: 'f3', projectId: 'p1', targetType: 'insight', targetId: 'i1', signal: 'accepted', createdAt: new Date().toISOString() },
    { feedbackId: 'f4', projectId: 'p2', targetType: 'anomaly', targetId: 'a1', signal: 'rejected', createdAt: new Date().toISOString() },
    { feedbackId: 'f5', projectId: 'p1', targetType: 'recommendation', targetId: 'r2', signal: 'corrected', correctedValue: 'P1', createdAt: new Date().toISOString() },
  ];

  it('counts total entries', () => {
    const result = aggregateLearningData(entries);
    expect(result.total).toBe(5);
  });

  it('counts signals correctly', () => {
    const result = aggregateLearningData(entries);
    expect(result.signalCounts.accepted).toBe(2);
    expect(result.signalCounts.rejected).toBe(2);
    expect(result.signalCounts.corrected).toBe(1);
    expect(result.signalCounts.deferred).toBe(0);
  });

  it('computes acceptanceRate and rejectionRate', () => {
    const result = aggregateLearningData(entries);
    expect(result.acceptanceRate).toBe(40); // 2/5
    expect(result.rejectionRate).toBe(40);  // 2/5
  });

  it('builds byTargetType breakdown', () => {
    const result = aggregateLearningData(entries);
    expect(result.byTargetType.recommendation.total).toBe(3);
    expect(result.byTargetType.recommendation.accepted).toBe(1);
    expect(result.byTargetType.recommendation.rejected).toBe(1);
    expect(result.byTargetType.insight.total).toBe(1);
    expect(result.byTargetType.anomaly.total).toBe(1);
  });

  it('extracts corrections with correctedValue', () => {
    const result = aggregateLearningData(entries);
    expect(result.corrections).toHaveLength(1);
    expect(result.corrections[0].correctedValue).toBe('P1');
    expect(result.corrections[0].targetId).toBe('r2');
  });

  it('lists topRejected by frequency', () => {
    const result = aggregateLearningData(entries);
    expect(result.topRejected[0].targetId).toBe('r2');
    expect(result.topRejected[0].count).toBe(1);
  });

  it('handles empty input', () => {
    const result = aggregateLearningData([]);
    expect(result.total).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.topRejected).toHaveLength(0);
  });
});
