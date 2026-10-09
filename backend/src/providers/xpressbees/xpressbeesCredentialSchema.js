'use strict';

const Joi = require('joi');

/**
 * Credentials schema for Xpressbees provider key.
 * Xpressbees supports Bearer token / api_key or email + password for customer login.
 * Tolerates UI aliases: username, api_key, api_secret.
 */
const xpressbeesCredentialSchema = Joi.object({
  token: Joi.string().optional(),
  api_key: Joi.string().optional(),
  email: Joi.string().optional(),
  password: Joi.string().optional(),
  username: Joi.string().optional(),
  api_secret: Joi.string().optional(),
})
.or('token', 'api_key', 'email', 'username')
.unknown(true);

module.exports = xpressbeesCredentialSchema;
