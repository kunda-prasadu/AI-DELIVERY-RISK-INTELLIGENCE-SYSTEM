'use strict';

const config = require('../config/metrics.config');
const aggregator = require('./metrics.aggregator');

class PipelineOrchestrator {
  constructor() {
    this.intervalId = null;
    this.previousSnapshot = new Map();
  }

  captureSnapshot() {
    const list = aggregator.listProjectMetrics();
    list.forEach((metrics) => {
      this.previousSnapshot.set(metrics.projectId, {
        ...metrics,
        severityCounts: { ...metrics.severityCounts },
        sourceCounts: { ...metrics.sourceCounts },
        eventTypeCounts: { ...metrics.eventTypeCounts },
      });
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
}

module.exports = new PipelineOrchestrator();
