'use strict';

const config = require('../config/obs.config');

/**
 * In-memory metrics collector with time-series retention.
 * Emits Prometheus-compatible output.
 *
 * Metrics tracked:
 *   - http_requests_total (counter) — labeled by method, path, status
 *   - http_request_duration_seconds (histogram) — labeled by method, path
 *   - application_errors_total (counter) — labeled by type
 *   - service_health (gauge) — labeled by service_name
 */

class MetricsCollector {
  constructor() {
    this._reset();
  }

  _reset() {
    this.httpRequestsTotal = new Map();     // "METHOD:PATH:STATUS" → count
    this.httpRequestDurations = new Map();  // "METHOD:PATH" → Array<duration_ms>
    this.applicationErrorsTotal = new Map(); // "ERROR_TYPE" → count
    this.serviceHealth = new Map();         // "SERVICE_NAME" → { healthy, lastCheck }
    this.startTime = Date.now();
  }

  // ── Request metrics ─────────────────────────────────────────────────────

  recordHttpRequest(method, path, statusCode, durationMs) {
    const key = `${method}:${path}:${statusCode}`;
    const current = this.httpRequestsTotal.get(key) || 0;
    this.httpRequestsTotal.set(key, current + 1);

    // Store durations for histogram
    const durationKey = `${method}:${path}`;
    const durations = this.httpRequestDurations.get(durationKey) || [];
    durations.push(durationMs);

    // Prune old durations (keep last 1000 per endpoint)
    if (durations.length > 1000) durations.shift();
    this.httpRequestDurations.set(durationKey, durations);
  }

  // ── Error metrics ───────────────────────────────────────────────────────

  recordError(errorType) {
    const current = this.applicationErrorsTotal.get(errorType) || 0;
    this.applicationErrorsTotal.set(errorType, current + 1);
  }

  // ── Health status ───────────────────────────────────────────────────────

  setServiceHealth(serviceName, healthy, details = null) {
    this.serviceHealth.set(serviceName, {
      healthy,
      lastCheck: new Date().toISOString(),
      details,
    });
  }

  getServiceHealth(serviceName) {
    return this.serviceHealth.get(serviceName) || null;
  }

  getAllHealth() {
    return Object.fromEntries(this.serviceHealth);
  }

  // ── Prometheus export ───────────────────────────────────────────────────

  /**
   * Export metrics in Prometheus text format.
   * @returns {string}
   */
  exportPrometheus() {
    const lines = [
      '# HELP http_requests_total Total HTTP requests',
      '# TYPE http_requests_total counter',
    ];

    // HTTP requests counter
    for (const [key, count] of this.httpRequestsTotal) {
      const [method, path, status] = key.split(':');
      lines.push(
        `http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`
      );
    }

    lines.push('');
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');

    // HTTP request duration histogram (simplified: just avg, min, max, count)
    for (const [key, durations] of this.httpRequestDurations) {
      const [method, path] = key.split(':');
      if (durations.length === 0) continue;

      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);

      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="0.5"} ${avg / 1000}`
      );
      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="min"} ${min / 1000}`
      );
      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="max"} ${max / 1000}`
      );
      lines.push(
        `http_request_duration_seconds_count{method="${method}",path="${path}"} ${durations.length}`
      );
    }

    lines.push('');
    lines.push('# HELP application_errors_total Total application errors');
    lines.push('# TYPE application_errors_total counter');

    // Application errors counter
    for (const [errorType, count] of this.applicationErrorsTotal) {
      lines.push(`application_errors_total{type="${errorType}"} ${count}`);
    }

    lines.push('');
    lines.push('# HELP service_health Service health status (1=healthy, 0=unhealthy)');
    lines.push('# TYPE service_health gauge');

    // Service health gauge
    for (const [service, info] of this.serviceHealth) {
      lines.push(`service_health{service="${service}"} ${info.healthy ? 1 : 0}`);
    }

    lines.push('');
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    const uptimeSeconds = (Date.now() - this.startTime) / 1000;
    lines.push(`process_uptime_seconds ${uptimeSeconds}`);

    return lines.join('\n') + '\n';
  }

  // ── Summary stats ───────────────────────────────────────────────────────

  getSummary() {
    const healthyServices = Array.from(this.serviceHealth.values()).filter(s => s.healthy).length;
    const totalServices = this.serviceHealth.size;
    const totalRequests = Array.from(this.httpRequestsTotal.values()).reduce((a, b) => a + b, 0);
    const totalErrors = Array.from(this.applicationErrorsTotal.values()).reduce((a, b) => a + b, 0);
    const uptime = (Date.now() - this.startTime) / 1000;

    return {
      uptime,
      healthyServices,
      totalServices,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests).toFixed(4) : '0.0000',
    };
  }
}

// Singleton instance
const collector = new MetricsCollector();

module.exports = collector;
