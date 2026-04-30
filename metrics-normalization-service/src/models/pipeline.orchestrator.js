'use strict';

const config = require('../config/metrics.config');
const aggregator = require('./metrics.aggregator');
const { HISTORY_WINDOW } = require('./risk.trend.calculator');

class PipelineOrchestrator {
  constructor() {
    this.intervalId = null;
    this.previousSnapshot = new Map();
    this.snapshotHistory = new Map(); // projectId → [{ snapshotAt, metrics }] oldest-first, max HISTORY_WINDOW
  }

  captureSnapshot() {
    const now = new Date().toISOString();
    const list = aggregator.listProjectMetrics();
    list.forEach((metrics) => {
      const copy = {
        ...metrics,
        severityCounts: { ...metrics.severityCounts },
        sourceCounts: { ...metrics.sourceCounts },
        eventTypeCounts: { ...metrics.eventTypeCounts },
      };

      // Keep single previous snapshot for existing trend/anomaly routes
      this.previousSnapshot.set(metrics.projectId, copy);

      // Append to rolling history, keep last HISTORY_WINDOW entries
      const history = this.snapshotHistory.get(metrics.projectId) || [];
      history.push({ snapshotAt: now, metrics: copy });
      if (history.length > HISTORY_WINDOW) history.shift();
      this.snapshotHistory.set(metrics.projectId, history);
    });
  }

  start() {
    if (this.intervalId) return false;

    this.intervalId = setInterval(() => {
      this.captureSnapshot();
    }, config.events.pollingIntervalMs);

    return true;
  }

  stop() {
    if (!this.intervalId) return false;
    clearInterval(this.intervalId);
    this.intervalId = null;
    return true;
  }

  isRunning() {
    return Boolean(this.intervalId);
  }

  getPreviousMetrics(projectId) {
    return this.previousSnapshot.get(projectId) || null;
  }

  getSnapshotHistory(projectId) {
    return this.snapshotHistory.get(projectId) || [];
  }
}

module.exports = new PipelineOrchestrator();
