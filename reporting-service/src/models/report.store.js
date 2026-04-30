'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for executive reports.
 * Keyed by reportId.
 */
class ReportStore {
  constructor() {
    this._reports = new Map();
  }

  save(report) {
    const id = report.reportId || uuidv4();
    const record = { ...report, reportId: id };
    this._reports.set(id, record);
    return record;
  }

  findById(reportId) {
    return this._reports.get(reportId) || null;
  }

  list(filters = {}) {
    const { reportType, requestedBy } = filters;
    const results = [];
    for (const r of this._reports.values()) {
      if (reportType && r.reportType !== reportType) continue;
      if (requestedBy && r.requestedBy !== requestedBy) continue;
      results.push(r);
    }
    // Newest first
    return results.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  }

  clear() {
    this._reports.clear();
  }
}

module.exports = new ReportStore();
