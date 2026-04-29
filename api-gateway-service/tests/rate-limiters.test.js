'use strict';

jest.mock('express-rate-limit', () => jest.fn(() => (req, _res, next) => next()));

describe('rate-limiters', () => {
  test('creates route-specific limiters with configured max values', () => {
    jest.resetModules();
    const rateLimit = require('express-rate-limit');
    const config = require('../src/config/gateway.config');
    jest.clearAllMocks();

    jest.isolateModules(() => {
      require('../src/middleware/rate-limiters');
    });

    const args = rateLimit.mock.calls.map((call) => call[0]);
    const maxValues = args.map((a) => a.max);

    expect(maxValues).toEqual(
      expect.arrayContaining([
        config.rateLimit.globalMax,
        config.rateLimit.authMax,
        config.rateLimit.projectsMax,
        config.rateLimit.metricsMax,
        config.rateLimit.observabilityMax,
      ])
    );
  });
});
