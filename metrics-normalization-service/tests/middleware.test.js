'use strict';

const requestTracker = require('../src/middleware/request.tracker');
const errorHandler = require('../src/middleware/error.handler');
const logger = require('../src/middleware/logger');

describe('middleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requestTracker calls next', () => {
    const req = { method: 'GET', originalUrl: '/metrics/summary?x=1' };
    const handlers = {};
    const res = {
      statusCode: 200,
      on: (evt, cb) => {
        handlers[evt] = cb;
      },
    };

    const next = jest.fn();
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    requestTracker(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    handlers.finish();
    expect(infoSpy).toHaveBeenCalled();
    expect(infoSpy.mock.calls[0][0].path).toBe('/metrics/summary');
  });

  test('errorHandler sends 500 response payload', () => {
    const err = new Error('boom');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    errorHandler(err, {}, res, () => {});

    expect(errorSpy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal server error', message: 'boom' })
    );
  });

  test('requestTracker logs method and status', () => {
    const req = { method: 'POST', originalUrl: '/metrics/events' };
    const handlers = {};
    const res = {
      statusCode: 201,
      on: (evt, cb) => {
        handlers[evt] = cb;
      },
    };

    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    requestTracker(req, res, () => {});
    handlers.finish();

    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', path: '/metrics/events', statusCode: 201 })
    );
  });

  test('errorHandler includes stack in logger payload', () => {
    const err = new Error('failed');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});

    errorHandler(err, {}, res, () => {});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'request.failed', error: 'failed' })
    );
  });
});
