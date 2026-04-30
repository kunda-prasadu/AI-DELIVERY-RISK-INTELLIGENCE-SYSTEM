'use strict';

const { FEEDBACK_SIGNALS, FEEDBACK_TARGETS } = require('./feedback.store');

/**
 * Aggregate feedback entries into learning signals for a given scope.
 *
 * @param {object[]} entries  — raw feedback records
 * @returns {object}          — aggregated learning summary
 */
function aggregateLearningData(entries = []) {
  const total = entries.length;

  // Signal distribution
  const signalCounts = Object.fromEntries(FEEDBACK_SIGNALS.map((s) => [s, 0]));
  for (const e of entries) {
    if (signalCounts[e.signal] !== undefined) signalCounts[e.signal] += 1;
  }

  const acceptanceRate = total > 0
    ? Math.round((signalCounts.accepted / total) * 100)
    : 0;

  const rejectionRate = total > 0
    ? Math.round((signalCounts.rejected / total) * 100)
    : 0;

  // Per-target breakdown
  const byTargetType = Object.fromEntries(FEEDBACK_TARGETS.map((t) => [t, { total: 0, accepted: 0, rejected: 0 }]));
  for (const e of entries) {
    if (!byTargetType[e.targetType]) continue;
    byTargetType[e.targetType].total += 1;
    if (e.signal === 'accepted') byTargetType[e.targetType].accepted += 1;
    if (e.signal === 'rejected') byTargetType[e.targetType].rejected += 1;
  }

  // Corrections — entries with a correctedValue present
  const corrections = entries.filter((e) => e.signal === 'corrected' && e.correctedValue);

  // Top rejected targets (by targetId frequency)
  const rejectedFrequency = {};
  for (const e of entries) {
    if (e.signal === 'rejected') {
      rejectedFrequency[e.targetId] = (rejectedFrequency[e.targetId] || 0) + 1;
    }
  }
  const topRejected = Object.entries(rejectedFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([targetId, count]) => ({ targetId, count }));

  return {
    total,
    signalCounts,
    acceptanceRate,
    rejectionRate,
    byTargetType,
    corrections: corrections.map((e) => ({
      feedbackId: e.feedbackId,
      targetId: e.targetId,
      targetType: e.targetType,
      correctedValue: e.correctedValue,
      createdAt: e.createdAt,
    })),
    topRejected,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { aggregateLearningData };
