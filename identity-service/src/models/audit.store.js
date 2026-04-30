'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const _entries = [];

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  return Object.keys(metadata)
    .sort()
    .reduce((acc, key) => {
      acc[key] = metadata[key];
      return acc;
    }, {});
}

function computeHash(entry) {
  const payload = {
    auditId: entry.auditId,
    timestamp: entry.timestamp,
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    outcome: entry.outcome,
    ipAddress: entry.ipAddress,
    userAgent: entry.userAgent,
    metadata: entry.metadata,
    previousHash: entry.previousHash,
  };

  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

const AuditStore = {
  record({
    actorId = null,
    actorRole = null,
    action,
    resourceType,
    resourceId = null,
    outcome,
    ipAddress = null,
    userAgent = null,
    metadata = {},
  }) {
    const previousHash = _entries.length ? _entries[_entries.length - 1].hash : null;
    const entry = {
      auditId: uuidv4(),
      timestamp: new Date().toISOString(),
      actorId,
      actorRole,
      action,
      resourceType,
      resourceId,
      outcome,
      ipAddress,
      userAgent,
      metadata: normalizeMetadata(metadata),
      previousHash,
    };

    entry.hash = computeHash(entry);
    _entries.push(entry);
    return { ...entry };
  },

  list({ action, outcome, actorId, limit } = {}) {
    let entries = [..._entries].reverse();

    if (action) {
      entries = entries.filter((entry) => entry.action === action);
    }
    if (outcome) {
      entries = entries.filter((entry) => entry.outcome === outcome);
    }
    if (actorId) {
      entries = entries.filter((entry) => entry.actorId === actorId);
    }
    if (limit) {
      entries = entries.slice(0, Number(limit));
    }

    return entries;
  },

  verifyIntegrity() {
    let previousHash = null;

    for (let index = 0; index < _entries.length; index += 1) {
      const entry = _entries[index];
      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          totalEntries: _entries.length,
          brokenAt: entry.auditId,
          lastHash: _entries.length ? _entries[_entries.length - 1].hash : null,
        };
      }

      const expectedHash = computeHash({
        ...entry,
        metadata: normalizeMetadata(entry.metadata),
      });

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          totalEntries: _entries.length,
          brokenAt: entry.auditId,
          lastHash: _entries.length ? _entries[_entries.length - 1].hash : null,
        };
      }

      previousHash = entry.hash;
    }

    return {
      valid: true,
      totalEntries: _entries.length,
      brokenAt: null,
      lastHash: _entries.length ? _entries[_entries.length - 1].hash : null,
    };
  },

  clear() {
    _entries.length = 0;
  },
};

module.exports = AuditStore;
