'use strict';

const Joi = require('joi');

/**
 * Credentials schema for Delhivery provider key.
 *
 * The Admin UI sends `api_key` and `username`. The controller normalises these
 * to `api_token` / `client_name` before validation, so we accept both names.
 * `.unknown(true)` ensures any extra normalised fields don't cause rejection.
 */
const delhiveryCredentialSchema = Joi.object({
  api_token: Joi.string().when('api_key', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  api_key: Joi.string().optional(),          // UI alias for api_token
  client_name: Joi.string().when('username', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  username: Joi.string().optional(),         // UI alias for client_name
  api_secret: Joi.string().optional(),       // extra field sent by UI — tolerated
}).unknown(true);

module.exports = delhiveryCredentialSchema;
