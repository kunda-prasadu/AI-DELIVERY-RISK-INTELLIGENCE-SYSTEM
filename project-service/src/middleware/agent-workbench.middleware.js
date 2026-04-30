'use strict';

const Joi = require('joi');
const logger = require('./logger');

const querySchema = Joi.object({
  insightLimit: Joi.number().integer().min(1).max(10).optional().default(3),
  recommendationLimit: Joi.number().integer().min(1).max(10).optional().default(3),
});

function validateAgentWorkbenchQuery(req, res, next) {
  const { error, value } = querySchema.validate(req.query, { stripUnknown: true });
  if (error) {
    return res.status(400).json({
      error: 'Invalid agent workbench query',
      details: error.details.map((detail) => detail.message),
    });
  }

  req.agentWorkbenchOptions = value;
  return next();
}

function auditAgentWorkbenchAccess(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      return;
    }

    logger.info('[AgentWorkbench] Viewed', {
      userId: req.user?.id,
      projectId: req.params.id,
      options: req.agentWorkbenchOptions,
      statusCode: res.statusCode,
    });
  });

  return next();
}

module.exports = {
  validateAgentWorkbenchQuery,
  auditAgentWorkbenchAccess,
};