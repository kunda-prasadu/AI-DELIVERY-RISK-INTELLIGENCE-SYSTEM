'use strict';

const retrievalEngine = require('../src/models/retrieval.engine');

describe('Retrieval Engine Model', () => {
  describe('tokenize()', () => {
    it('should tokenize text into lowercase keywords', () => {
      const tokens = retrievalEngine.tokenize('Deployment Pipeline FAILURE');
      if (tokens.size !== 3) throw new Error('should have 3 tokens');
      if (!tokens.has('deployment')) throw new Error('should contain deployment');
      if (!tokens.has('failure')) throw new Error('should contain failure');
    });

    it('should return empty set for empty string', () => {
      const tokens = retrievalEngine.tokenize('');
      if (tokens.size !== 0) throw new Error('should be empty');
    });

    it('should handle null/undefined gracefully', () => {
      const t1 = retrievalEngine.tokenize(null);
      const t2 = retrievalEngine.tokenize(undefined);
      if (t1.size !== 0 || t2.size !== 0) throw new Error('should return empty set');
    });
  });

  describe('calculateScore()', () => {
    it('should calculate overlap score between query and document', () => {
      const qTokens = new Set(['deployment', 'pipeline', 'failure']);
      const dTokens = new Set(['deployment', 'pipeline', 'issue', 'system']);
      const score = retrievalEngine.calculateScore(qTokens, dTokens);
      if (score !== 67) throw new Error('score should be 67 (2/3 match rounds to 67)');
    });

    it('should return 0 if no overlap', () => {
      const qTokens = new Set(['deployment']);
      const dTokens = new Set(['database']);
      const score = retrievalEngine.calculateScore(qTokens, dTokens);
      if (score !== 0) throw new Error('score should be 0');
    });

    it('should return 100 for perfect match', () => {
      const qTokens = new Set(['test', 'query']);
      const dTokens = new Set(['test', 'query', 'extra']);
      const score = retrievalEngine.calculateScore(qTokens, dTokens);
      if (score !== 100) throw new Error('score should be 100');
    });
  });

  describe('retrieve()', () => {
    const docs = [
      { id: 'd1', text: 'deployment pipeline failure', source: 'alert' },
      { id: 'd2', text: 'database connection timeout', source: 'log' },
      { id: 'd3', text: 'deployment success in production', source: 'metric' },
    ];

    it('should retrieve and rank matching documents', () => {
      const results = retrievalEngine.retrieve('deployment failure', docs);
      if (results.length === 0) throw new Error('should find results');
      if (results[0].id !== 'd1') throw new Error('top result should be d1');
    });

    it('should respect limit parameter', () => {
      const results = retrievalEngine.retrieve('deployment', docs, 1);
      if (results.length > 1) throw new Error('should not exceed limit');
    });

    it('should return empty for empty query', () => {
      const results = retrievalEngine.retrieve('', docs);
      if (results.length !== 0) throw new Error('should be empty');
    });

    it('should return empty for non-matching query', () => {
      const results = retrievalEngine.retrieve('xyz123', docs);
      if (results.length !== 0) throw new Error('should be empty');
    });
  });
});
