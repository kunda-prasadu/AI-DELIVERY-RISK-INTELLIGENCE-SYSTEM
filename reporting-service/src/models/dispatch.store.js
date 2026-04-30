'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for weekly dispatch records.
 */
class DispatchStore {
  constructor() {
    this._dispatches = new Map();
  }

  save(dispatch) {
    const id = dispatch.dispatchId || uuidv4();
    const record = { ...dispatch, dispatchId: id };
    this._dispatches.set(id, record);
    return record;
  }

  findById(dispatchId) {
    return this._dispatches.get(dispatchId) || null;
  }

  list() {
    return [...this._dispatches.values()].sort(
      (a, b) => new Date(b.dispatchedAt) - new Date(a.dispatchedAt)
    );
  }

  clear() {
    this._dispatches.clear();
  }
}

module.exports = new DispatchStore();
