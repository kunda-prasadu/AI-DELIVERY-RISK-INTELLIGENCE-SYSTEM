'use strict';

/**
 * Document Store Model
 * In-memory storage for document chunks with project-level isolation
 */

class DocumentStore {
  constructor() {
    this.documents = new Map(); // key: projectId, value: array of chunks
  }

  /**
   * Ingest document chunks for a project
   * @param {string} projectId - Project identifier
   * @param {Array} chunks - Array of { id, text, source, metadata }
   * @returns {Object} { ingestedCount, projectId }
   */
  ingestDocuments(projectId, chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error('chunks must be a non-empty array');
    }

    if (!this.documents.has(projectId)) {
      this.documents.set(projectId, []);
    }

    const existing = this.documents.get(projectId);
    const validated = chunks.map((c) => ({
      id: c.id || `chunk-${Date.now()}-${Math.random()}`,
      text: c.text || '',
      source: c.source || 'unknown',
      metadata: c.metadata || {},
      createdAt: new Date().toISOString(),
    }));

    this.documents.set(projectId, [...existing, ...validated]);

    return {
      ingestedCount: validated.length,
      projectId,
    };
  }

  /**
   * Retrieve all chunks for a project
   * @param {string} projectId - Project identifier
   * @returns {Array} Document chunks
   */
  getDocuments(projectId) {
    return this.documents.get(projectId) || [];
  }

  /**
   * Clear documents for a project (for testing/reset)
   * @param {string} projectId - Project identifier
   */
  clearProject(projectId) {
    this.documents.delete(projectId);
  }
}

module.exports = new DocumentStore();
