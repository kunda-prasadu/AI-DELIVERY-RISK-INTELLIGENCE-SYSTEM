'use strict';

const request = require('supertest');
const app = require('../src/index');
const documentStore = require('../src/models/document.store');

describe('RAG Retrieval Service', () => {
  beforeEach(() => {
    documentStore.clearProject('project-001');
    documentStore.clearProject('project-002');
  });

  describe('POST /rag/documents', () => {
    it('should ingest documents for a project', () => {
      return request(app)
        .post('/rag/documents')
        .send({
          projectId: 'project-001',
          chunks: [
            { id: 'chunk-1', text: 'deployment pipeline failure in CI/CD', source: 'alert' },
            { id: 'chunk-2', text: 'database connection timeout', source: 'log' },
          ],
        })
        .expect(201)
        .expect((res) => {
          if (res.body.ingestedCount !== 2) throw new Error('should ingest 2 chunks');
          if (res.body.projectId !== 'project-001') throw new Error('projectId mismatch');
        });
    });

    it('should return 400 if chunks array is empty', () => {
      return request(app)
        .post('/rag/documents')
        .send({
          projectId: 'project-001',
          chunks: [],
        })
        .expect(400);
    });

    it('should return 400 if projectId is missing', () => {
      return request(app)
        .post('/rag/documents')
        .send({
          chunks: [{ text: 'test' }],
        })
        .expect(400);
    });
  });

  describe('POST /rag/retrieve', () => {
    beforeEach(() => {
      documentStore.ingestDocuments('project-001', [
        { id: 'c1', text: 'deployment pipeline failure in CI/CD system', source: 'alert' },
        { id: 'c2', text: 'database connection timeout during peak hours', source: 'log' },
        { id: 'c3', text: 'memory leak in production environment', source: 'metric' },
      ]);
    });

    it('should retrieve documents matching query', () => {
      return request(app)
        .post('/rag/retrieve')
        .send({
          query: 'deployment pipeline failure',
          projectId: 'project-001',
        })
        .expect(200)
        .expect((res) => {
          if (res.body.resultCount === 0) throw new Error('should find at least one result');
          if (res.body.results[0].score <= 0) throw new Error('top result should have positive score');
        });
    });

    it('should limit results to specified limit', () => {
      return request(app)
        .post('/rag/retrieve')
        .send({
          query: 'system environment',
          projectId: 'project-001',
          limit: 2,
        })
        .expect(200)
        .expect((res) => {
          if (res.body.results.length > 2) throw new Error('should not exceed limit');
        });
    });

    it('should retrieve across all projects if projectId not specified', () => {
      documentStore.ingestDocuments('project-002', [
        { id: 'c4', text: 'network latency spike detected', source: 'metric' },
      ]);

      return request(app)
        .post('/rag/retrieve')
        .send({
          query: 'network latency',
        })
        .expect(200)
        .expect((res) => {
          if (res.body.resultCount === 0) throw new Error('should find result across all projects');
        });
    });

    it('should return 400 if query is missing', () => {
      return request(app)
        .post('/rag/retrieve')
        .send({
          projectId: 'project-001',
        })
        .expect(400);
    });

    it('should return empty results for non-matching query', () => {
      return request(app)
        .post('/rag/retrieve')
        .send({
          query: 'xyzabc123notfound',
          projectId: 'project-001',
        })
        .expect(200)
        .expect((res) => {
          if (res.body.resultCount !== 0) throw new Error('should return no results');
        });
    });
  });

  describe('Health Checks', () => {
    it('GET /health/live should return ok', () => {
      return request(app)
        .get('/health/live')
        .expect(200)
        .expect((res) => {
          if (res.body.status !== 'ok') throw new Error('status should be ok');
          if (res.body.service !== 'rag-retrieval-service') throw new Error('service name mismatch');
        });
    });

    it('GET /health/ready should return ready', () => {
      return request(app)
        .get('/health/ready')
        .expect(200)
        .expect((res) => {
          if (res.body.status !== 'ready') throw new Error('status should be ready');
        });
    });
  });
});
