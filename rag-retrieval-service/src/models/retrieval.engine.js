'use strict';

/**
 * Retrieval Engine Model
 * Keyword-based and simple ranking retrieval for RAG queries
 */

class RetrievalEngine {
  /**
   * Tokenize text into lowercase keywords
   * @param {string} text - Text to tokenize
   * @returns {Set} Set of keywords
   */
  tokenize(text) {
    if (!text) return new Set();
    return new Set(text.toLowerCase().split(/\s+/).filter((w) => w.length > 0));
  }

  /**
   * Calculate keyword overlap score between query and document
   * @param {Set} queryTokens - Query tokens
   * @param {Set} docTokens - Document tokens
   * @returns {number} Score 0–100
   */
  calculateScore(queryTokens, docTokens) {
    if (queryTokens.size === 0 || docTokens.size === 0) return 0;

    let matches = 0;
    queryTokens.forEach((token) => {
      if (docTokens.has(token)) matches += 1;
    });

    const coverage = matches / queryTokens.size;
    return Math.round(coverage * 100);
  }

  /**
   * Retrieve and rank documents matching query
   * @param {string} query - Search query
   * @param {Array} documents - Document chunks to search
   * @param {number} limit - Max results to return (default 5)
   * @returns {Array} Ranked results [{ id, text, source, score, metadata }]
   */
  retrieve(query, documents, limit = 5) {
    if (!query || !Array.isArray(documents)) {
      return [];
    }

    const queryTokens = this.tokenize(query);
    if (queryTokens.size === 0) return [];

    const scored = documents.map((doc) => {
      const docTokens = this.tokenize(doc.text);
      const score = this.calculateScore(queryTokens, docTokens);
      return {
        id: doc.id,
        text: doc.text,
        source: doc.source,
        score,
        metadata: doc.metadata || {},
      };
    });

    return scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  }
}

module.exports = new RetrievalEngine();
