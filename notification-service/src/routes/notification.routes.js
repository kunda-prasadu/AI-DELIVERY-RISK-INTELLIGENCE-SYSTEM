'use strict';

const express = require('express');
const Joi = require('joi');
const store = require('../models/notification.store');
const dispatcher = require('../models/notification.dispatcher');

const router = express.Router();

router.post('/send', (req, res, next) => {
  try {
    const schema = Joi.object({
      projectId: Joi.string().required(),
      channel: Joi.string().valid(...dispatcher.supportedChannels).required(),
      recipient: Joi.string().required(),
      message: Joi.string().min(1).required(),
      metadata: Joi.object().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 400;
      return next(err);
    }

    const result = dispatcher.dispatch(value);
    return res.status(201).json({ notification: result });
  } catch (err) {
    return next(err);
  }
});

router.post('/broadcast', (req, res, next) => {
  try {
    const schema = Joi.object({
      projectId: Joi.string().required(),
      channels: Joi.array().items(Joi.string().valid(...dispatcher.supportedChannels)).min(1).required(),
      recipient: Joi.string().required(),
      message: Joi.string().min(1).required(),
      metadata: Joi.object().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 400;
      return next(err);
    }

    const result = dispatcher.broadcast(value);
    return res.status(201).json({ notifications: result, count: result.length });
  } catch (err) {
    return next(err);
  }
});

router.get('/history', (req, res) => {
  const records = store.list({
    projectId: req.query.projectId,
    channel: req.query.channel,
  });

  return res.status(200).json({
    notifications: records,
    total: records.length,
  });
});

module.exports = router;
