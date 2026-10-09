'use strict';

const Joi = require('joi');

/**
 * Credentials schema for Ecom Express provider key.
 * Ecom Express requires username and password (which can be provided via api_secret).
 */
const ecomExpressCredentialSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().when('api_secret', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  api_secret: Joi.string().optional(),
})
.unknown(true);

module.exports = ecomExpressCredentialSchema;
