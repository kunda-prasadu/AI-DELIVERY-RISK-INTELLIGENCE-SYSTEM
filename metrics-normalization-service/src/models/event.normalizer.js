'use strict';

const { v4: uuidv4 } = require('uuid');
const eventSchema = require('./event.schema');

function toSeverity(value) {
  const v = String(value || '').toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(v)) return v;
  return 'medium';
}

function normalizeEvent(raw) {
  const normalized = {
    id: raw.id || uuidv4(),
    source: String(raw.source || '').toLowerCase(),
    eventType: raw.eventType || raw.type || 'unknown',
    projectId: raw.projectId || raw.project || 'unknown-project',
    timestamp: raw.timestamp || new Date().toISOString(),
    severity: toSeverity(raw.severity),
    metadata: raw.metadata || {},
  };

  const { error, value } = eventSchema.validate(normalized);
  if (error) {
    return { valid: false, error: error.message, event: normalized };
  }

  return { valid: true, event: value };
}

function normalizeBatch(rawEvents = []) {
  const accepted = [];
  const rejected = [];

  rawEvents.forEach((raw) => {
    const res = normalizeEvent(raw);
    if (res.valid) accepted.push(res.event);
    else rejected.push({ reason: res.error, event: res.event });
  });

  return { accepted, rejected };
}

module.exports = {
  normalizeEvent,
  normalizeBatch,
};
