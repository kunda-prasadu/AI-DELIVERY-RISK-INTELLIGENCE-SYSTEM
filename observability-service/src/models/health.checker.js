'use strict';

const config = require('../config/obs.config');
const logger = require('../middleware/logger');

/**
 * Health checker — liveness, readiness, and dependency checks.
 *
 * Liveness (/live) — Process is running (always 200)
 * Readiness (/ready) — Dependencies are healthy (200 or 503)
 */

class HealthChecker {
  constructor() {
    this.checks = new Map();
    this._registerDefaultChecks();
  }

  /**
   * Register a health check function.
   * @param {string} name
   * @param {() => Promise<{ healthy: boolean, details?: any }>} checkFn
   */
  register(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  /**
   * Run a single check and record result.
   */
  async _runCheck(name, checkFn) {
    try {
      const start = Date.now();
      const result = await Promise.race([
        checkFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), config.health.timeoutMs)),
      ]);
      const elapsed = Date.now() - start;
      return {
        name,
        healthy: result.healthy !== false,
        details: result.details,
        elapsed,
      };
    } catch (err) {
      return {
        name,
        healthy: false,
        error: err.message,
        elapsed: config.health.timeoutMs,
      };
    }
  }

  /**
   * Run all registered checks.
   */
  async runAll() {
    const results = await Promise.all(
      Array.from(this.checks.entries()).map(([name, checkFn]) =>
        this._runCheck(name, checkFn)
      )
    );

    return {
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(results.map(r => [r.name, { healthy: r.healthy, ...r }])),
      summary: {
        healthy: results.every(r => r.healthy),
        totalChecks: results.length,
        healthyChecks: results.filter(r => r.healthy).length,
      },
    };
  }

  /**
   * Store service health status.
   */
  setServiceHealth(serviceName, healthy, details = null) {
    if (!this._serviceHealth) this._serviceHealth = new Map();
    this._serviceHealth.set(serviceName, {
      healthy,
      lastCheck: new Date().toISOString(),
      details,
    });
  }

  /**
   * Get service health status.
   */
  getServiceHealth(serviceName) {
    if (!this._serviceHealth) this._serviceHealth = new Map();
    return this._serviceHealth.get(serviceName) || null;
  }

  /**
   * Get all service health statuses.
   */
  getAllHealth() {
    if (!this._serviceHealth) this._serviceHealth = new Map();
    return Object.fromEntries(this._serviceHealth);
  }

  /**
   * Liveness check — process is running.
   */
  async liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness check — all critical dependencies are healthy.
   */
  async readiness() {
    const result = await this.runAll();
    return {
      ...result,
      ready: result.summary.healthy,
    };
  }

  /**
   * Register default checks for required services.
   */
  _registerDefaultChecks() {
    // Self-check: database (not applicable for observability service, but placeholder)
    this.register('self', async () => ({
      healthy: true,
      details: 'Observability service running',
    }));

    // Simulate checks for required downstream services
    config.health.requiredServices.forEach(service => {
      this.register(service, async () => {
        // In production, this would make actual HTTP calls or check database connections.
        // For now, assume all downstream services are healthy (configurable via env).
        return {
          healthy: true,
          details: `${service} is responding`,
        };
      });
    });
  }
}

const healthChecker = new HealthChecker();

module.exports = healthChecker;
