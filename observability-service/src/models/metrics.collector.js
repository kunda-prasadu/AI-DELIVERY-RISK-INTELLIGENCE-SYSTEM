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
    this.dashboardRenderDurations = new Map(); // "ROUTE" → Array<duration_ms>
    this.applicationErrorsTotal = new Map(); // "ERROR_TYPE" → count
    this.serviceHealth = new Map();         // "SERVICE_NAME" → { healthy, lastCheck }
    this.startTime = Date.now();
  }

  _calculatePercentile(values, percentile) {
    if (!values.length) {
      return 0;
    }

    const sorted = [...values].sort((left, right) => left - right);
    const position = Math.ceil((percentile / 100) * sorted.length) - 1;
    const index = Math.max(0, Math.min(position, sorted.length - 1));
    return sorted[index];
  }

  _summarizeDurations(durations) {
    if (!durations.length) {
      return null;
    }

    const totalMs = durations.reduce((sum, value) => sum + value, 0);

    return {
      count: durations.length,
      minMs: Math.min(...durations),
      avgMs: Number((totalMs / durations.length).toFixed(2)),
      p50Ms: this._calculatePercentile(durations, 50),
      p95Ms: this._calculatePercentile(durations, 95),
      maxMs: Math.max(...durations),
    };
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

  getHttpLatencySummary() {
    const byEndpoint = Array.from(this.httpRequestDurations.entries())
      .map(([key, durations]) => {
        const separatorIndex = key.indexOf(':');
        const method = key.slice(0, separatorIndex);
        const path = key.slice(separatorIndex + 1);
        const summary = this._summarizeDurations(durations);

        if (!summary) {
          return null;
        }

        return {
          method,
          path,
          ...summary,
          withinTarget: summary.p95Ms <= config.metrics.apiP95TargetMs,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.p95Ms - left.p95Ms);

    const overallSummary = this._summarizeDurations(
      Array.from(this.httpRequestDurations.values()).flat()
    );

    return {
      targetP95Ms: config.metrics.apiP95TargetMs,
      overall: overallSummary
        ? {
            ...overallSummary,
            withinTarget: overallSummary.p95Ms <= config.metrics.apiP95TargetMs,
          }
        : null,
      byEndpoint,
    };
  }

  recordDashboardRender(route, durationMs) {
    const routeKey = route || '/';
    const durations = this.dashboardRenderDurations.get(routeKey) || [];
    durations.push(durationMs);

    if (durations.length > 1000) durations.shift();
    this.dashboardRenderDurations.set(routeKey, durations);
  }

  getDashboardLatencySummary() {
    const byRoute = Array.from(this.dashboardRenderDurations.entries())
      .map(([route, durations]) => {
        const summary = this._summarizeDurations(durations);
        if (!summary) {
          return null;
        }

        return {
          route,
          ...summary,
          withinTarget: summary.p95Ms <= config.metrics.dashboardP95TargetMs,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.p95Ms - left.p95Ms);

    const overallSummary = this._summarizeDurations(
      Array.from(this.dashboardRenderDurations.values()).flat()
    );

    return {
      targetP95Ms: config.metrics.dashboardP95TargetMs,
      overall: overallSummary
        ? {
            ...overallSummary,
            withinTarget: overallSummary.p95Ms <= config.metrics.dashboardP95TargetMs,
          }
        : null,
      byRoute,
    };
  }

  getSloSummary() {
    const api = this.getHttpLatencySummary();
    const dashboard = this.getDashboardLatencySummary();

    return {
      generatedAt: new Date().toISOString(),
      api,
      dashboard,
      overall: {
        apiWithinTarget: api.overall ? api.overall.withinTarget : null,
        dashboardWithinTarget: dashboard.overall ? dashboard.overall.withinTarget : null,
      },
    };
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
      const separatorIndex = key.indexOf(':');
      const method = key.slice(0, separatorIndex);
      const path = key.slice(separatorIndex + 1);
      const summary = this._summarizeDurations(durations);
      if (!summary) continue;

      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="0.5"} ${summary.p50Ms / 1000}`
      );
      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="0.95"} ${summary.p95Ms / 1000}`
      );
      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="min"} ${summary.minMs / 1000}`
      );
      lines.push(
        `http_request_duration_seconds{method="${method}",path="${path}",quantile="max"} ${summary.maxMs / 1000}`
      );
      lines.push(
        `http_request_duration_seconds_count{method="${method}",path="${path}"} ${summary.count}`
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

    const latency = this.getHttpLatencySummary();
    const dashboardLatency = this.getDashboardLatencySummary();

    return {
      uptime,
      healthyServices,
      totalServices,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests).toFixed(4) : '0.0000',
      latency,
      dashboardLatency,
    };
  }
}

// Singleton instance
const collector = new MetricsCollector();

module.exports = collector;
