'use strict';

class MetricsAggregator {
  constructor() {
    this._reset();
  }

  _reset() {
    this.byProject = new Map();
    this.totalEvents = 0;
    this.lastUpdated = null;
  }

  ingest(event) {
    const key = event.projectId;
    if (!this.byProject.has(key)) {
      this.byProject.set(key, {
        projectId: key,
        totalEvents: 0,
        sourceCounts: { jira: 0, github: 0, qa: 0, cicd: 0 },
        severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
        eventTypeCounts: {},
        latestEventAt: null,
      });
    }

    const row = this.byProject.get(key);
    row.totalEvents += 1;
    row.sourceCounts[event.source] = (row.sourceCounts[event.source] || 0) + 1;
    row.severityCounts[event.severity] = (row.severityCounts[event.severity] || 0) + 1;
    row.eventTypeCounts[event.eventType] = (row.eventTypeCounts[event.eventType] || 0) + 1;

    const ts = new Date(event.timestamp).toISOString();
    if (!row.latestEventAt || ts > row.latestEventAt) row.latestEventAt = ts;

    this.totalEvents += 1;
    this.lastUpdated = new Date().toISOString();
  }

  ingestBatch(events = []) {
    events.forEach((e) => this.ingest(e));
    return { processed: events.length };
  }

  getProjectMetrics(projectId) {
    return this.byProject.get(projectId) || null;
  }

  listProjectMetrics() {
    return Array.from(this.byProject.values());
  }

  summary() {
    const projects = this.byProject.size;
    const withCritical = this.listProjectMetrics().filter((p) => p.severityCounts.critical > 0).length;
    const withHigh = this.listProjectMetrics().filter((p) => p.severityCounts.high > 0).length;

    return {
      totalEvents: this.totalEvents,
      projects,
      projectsWithCritical: withCritical,
      projectsWithHigh: withHigh,
      lastUpdated: this.lastUpdated,
    };
  }
}

module.exports = new MetricsAggregator();
