'use strict';

const express = require('express');
const Joi = require('joi');
const documentStore = require('../models/document.store');
const retrievalEngine = require('../models/retrieval.engine');

const router = express.Router();

/**
 * POST /documents
 * Ingest document chunks for a project
 */
router.post('/documents', (req, res, next) => {
  try {
    const schema = Joi.object({
      projectId: Joi.string().required(),
      chunks: Joi.array()
        .items(
          Joi.object({
            id: Joi.string(),
            text: Joi.string().required(),
            source: Joi.string(),
            metadata: Joi.object(),
          })
        )
        .required()
        .min(1),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 400;
      return next(err);
    }

    const result = documentStore.ingestDocuments(value.projectId, value.chunks);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /retrieve
 * Retrieve ranked documents matching a query
 * Query params: query (required), projectId (optional), limit (optional, default 5)
 */
router.post('/retrieve', (req, res, next) => {
  try {
    const schema = Joi.object({
      query: Joi.string().required(),
      projectId: Joi.string(),
      limit: Joi.number().min(1).max(50).default(5),
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.message);
      err.statusCode = 400;
      return next(err);
    }

    const documents = value.projectId
      ? documentStore.getDocuments(value.projectId)
      : Array.from(documentStore.documents.values()).flat();

    const results = retrievalEngine.retrieve(value.query, documents, value.limit);

    res.status(200).json({
      query: value.query,
      projectId: value.projectId || null,
      resultCount: results.length,
      results,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
