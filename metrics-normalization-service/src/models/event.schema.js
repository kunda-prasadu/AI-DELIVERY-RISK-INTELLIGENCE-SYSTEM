'use strict';

const Joi = require('joi');

const eventSchema = Joi.object({
  id: Joi.string().required(),
  source: Joi.string().valid('jira', 'github', 'qa', 'cicd').required(),
  eventType: Joi.string().required(),
  projectId: Joi.string().required(),
  timestamp: Joi.date().iso().required(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  metadata: Joi.object().default({}),
});

module.exports = eventSchema;
