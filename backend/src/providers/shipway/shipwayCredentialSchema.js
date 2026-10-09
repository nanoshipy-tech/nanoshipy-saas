'use strict';

const Joi = require('joi');

/**
 * Credentials schema for Shipway provider key.
 * Shipway authenticates via HTTP Basic Auth (email/username + license key).
 */
const shipwayCredentialSchema = Joi.object({
  username: Joi.string().optional(),
  email: Joi.string().email().optional(),
  license_key: Joi.string().required(),
  warehouse_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  return_warehouse_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  carrier_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
})
.or('username', 'email')
.unknown(true);

module.exports = shipwayCredentialSchema;
