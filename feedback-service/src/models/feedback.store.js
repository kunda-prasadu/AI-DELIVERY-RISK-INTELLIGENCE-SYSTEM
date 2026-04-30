'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Feedback target types — what entity the feedback is about.
 */
const FEEDBACK_TARGETS = ['recommendation', 'insight', 'anomaly', 'report'];

/**
 * Feedback signal types.
 * - accepted   : user acted on / agreed with the item
 * - rejected   : user dismissed / disagreed with the item
 * - deferred   : user acknowledged but wants to revisit later
 * - corrected  : user provided a correction / override
 */
const FEEDBACK_SIGNALS = ['accepted', 'rejected', 'deferred', 'corrected'];

/**
 * In-memory feedback store.
 */
class FeedbackStore {
  constructor() {
    this._entries = new Map();
  }

  /**
   * Persist a feedback entry and return it.
   *
   * @param {object} entry
   * @returns {object}
   */
  save(entry) {
    const id = uuidv4();
    const record = { ...entry, feedbackId: id, createdAt: new Date().toISOString() };
    this._entries.set(id, record);
    return record;
  }

  /**
   * Find by feedbackId.
   *
   * @param {string} id
   * @returns {object|null}
   */
  findById(id) {
    return this._entries.get(id) || null;
  }

  /**
   * List with optional filters.
   *
   * @param {{ targetType?: string, targetId?: string, signal?: string, projectId?: string }} filters
   * @returns {object[]}
   */
  list(filters = {}) {
    const { targetType, targetId, signal, projectId } = filters;
    const results = [];
    for (const entry of this._entries.values()) {
      if (targetType && entry.targetType !== targetType) continue;
      if (targetId && entry.targetId !== targetId) continue;
      if (signal && entry.signal !== signal) continue;
      if (projectId && entry.projectId !== projectId) continue;
      results.push(entry);
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  clear() {
    this._entries.clear();
  }
}

module.exports = { FeedbackStore, FEEDBACK_TARGETS, FEEDBACK_SIGNALS, store: new FeedbackStore() };
