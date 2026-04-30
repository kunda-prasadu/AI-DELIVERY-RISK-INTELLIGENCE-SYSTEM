const { v4: uuidv4 } = require('uuid');

class ForecastStore {
  constructor() {
    this._entries = new Map();
  }

  save(forecast) {
    const forecastId = uuidv4();
    const entry = { ...forecast, forecastId, savedAt: new Date().toISOString() };
    this._entries.set(forecastId, entry);
    return entry;
  }

  findById(forecastId) {
    return this._entries.get(forecastId) || null;
  }

  /**
   * @param {Object} filters
   * @param {string} [filters.forecastType]
   * @param {string} [filters.projectId]
   */
  list({ forecastType, projectId } = {}) {
    let result = Array.from(this._entries.values());
    if (forecastType) {
      result = result.filter(e => e.forecastType === forecastType);
    }
    if (projectId) {
      result = result.filter(e => e.projectId === projectId || (Array.isArray(e.completionForecasts) && e.completionForecasts.some(c => c.projectId === projectId)));
    }
    return result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  }

  clear() {
    this._entries.clear();
  }
}

const store = new ForecastStore();
module.exports = { ForecastStore, store };
