'use strict';

const Joi = require('joi');

/**
 * Credentials schema for Shadowfax provider key.
 * Shadowfax requires token or api_key (tolerates api_secret as alias).
 */
const shadowfaxCredentialSchema = Joi.object({
  token: Joi.string().optional(),
  api_key: Joi.string().optional(),
  api_secret: Joi.string().optional(),
  username: Joi.string().optional(),
  client_code: Joi.string().optional(),
  store_id: Joi.string().optional(),
})
.or('token', 'api_key', 'api_secret')
.unknown(true);

module.exports = shadowfaxCredentialSchema;
