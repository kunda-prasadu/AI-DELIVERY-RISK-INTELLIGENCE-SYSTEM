'use strict';

const logger = require('./logger');
const { normalizedEventSchema } = require('../normalizer/event.schema');

/**
 * SchemaValidator — validates NormalizedEvents against the canonical Joi schema.
 *
 * Invalid events are logged with the rejection reason and MUST NOT be
 * forwarded to downstream agents (PRD MW-02).
 */
const schemaValidator = {
  /**
   * Validate a single NormalizedEvent.
   * @param {object} event
   * @returns {{ valid: boolean, errors: string[]|null, value: object|null }}
   */
  validate(event) {
    const { error, value } = normalizedEventSchema.validate(event, {
      abortEarly: false,       // collect all errors
      allowUnknown: false,     // reject unknown fields
      stripUnknown: true,      // remove extra keys before forwarding
    });

    if (error) {
      const errors = error.details.map(d => d.message);

      logger.warn('[SchemaValidator] Event rejected — schema violation', {
        eventId: event?.id || 'n/a',
        source: event?.source || 'n/a',
        errors,
      });

      return { valid: false, errors, value: null };
    }

    return { valid: true, errors: null, value };
  },
};

module.exports = schemaValidator;
