'use strict';

const express = require('express');
const axios = require('axios');
const Joi = require('joi');
const router = express.Router();

const proxyInputSchema = Joi.object({
  method: Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE').required(),
  path: Joi.string().required(),
  targetBase: Joi.string().uri().required(),
  body: Joi.any(),
});

async function forwardRequest({ method, targetBase, path, body, headers, query }) {
  const response = await axios({
    method,
    url: `${targetBase}${path}`,
    headers,
    params: query,
    data: body,
    timeout: 8000,
    validateStatus: () => true,
  });

  return response;
}

function buildForwardHeaders(req) {
  const out = {
    'Content-Type': req.headers['content-type'] || 'application/json',
    'X-Forwarded-By': 'api-gateway-service',
  };

  if (req.headers.authorization) {
    out.Authorization = req.headers.authorization;
  }

  return out;
}

function createProxyHandler(targetBase, stripPrefix) {
  return async (req, res, next) => {
    try {
      const path = req.path || '/';
      const payload = {
        method: req.method,
        path,
        targetBase,
        body: req.body,
      };

      const { error } = proxyInputSchema.validate(payload);
      if (error) return res.status(400).json({ error: error.message });

      const upstream = await forwardRequest({
        method: payload.method,
        targetBase: payload.targetBase,
        path: payload.path,
        body: payload.body,
        headers: buildForwardHeaders(req),
        query: req.query,
      });

      Object.entries(upstream.headers || {}).forEach(([k, v]) => {
        if (k.toLowerCase() === 'transfer-encoding') return;
        res.setHeader(k, v);
      });

      return res.status(upstream.status).send(upstream.data);
    } catch (err) {
      if (err.response) {
        return res.status(err.response.status).json(err.response.data);
      }
      return next(err);
    }
  };
}

module.exports = {
  router,
  createProxyHandler,
  buildForwardHeaders,
  forwardRequest,
};
