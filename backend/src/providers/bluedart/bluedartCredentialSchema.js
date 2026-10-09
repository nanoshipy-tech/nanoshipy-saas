'use strict';

const Joi = require('joi');

/**
 * Credentials schema for Blue Dart provider key.
 * Blue Dart supports JWT/API key or LoginID + CustomerCode + LicenceKey + Password.
 * Tolerates UI aliases: username, api_key, api_secret.
 */
const bluedartCredentialSchema = Joi.object({
  login_id: Joi.string().optional(),
  customer_code: Joi.string().optional(),
  license_key: Joi.string().optional(),
  licence_key: Joi.string().optional(),
  password: Joi.string().optional(),
  jwt_token: Joi.string().optional(),
  api_key: Joi.string().optional(),
  api_secret: Joi.string().optional(),
  username: Joi.string().optional(),
})
.or('jwt_token', 'api_key', 'login_id', 'username')
.unknown(true);

module.exports = bluedartCredentialSchema;
