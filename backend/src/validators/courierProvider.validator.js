'use strict';

const Joi = require('joi');
const registry = require('../providers/ProviderRegistry');

// Credentials schemas per provider_key
const credentialsSchemaMap = {
  mock: Joi.object({
    api_key: Joi.string().required(),
    api_secret: Joi.string().required(),
  }),
  shipway: require('../providers/shipway/shipwayCredentialSchema'),
  delhivery: require('../providers/delhivery/delhiveryCredentialSchema'),
  bluedart: require('../providers/bluedart/bluedartCredentialSchema'),
  xpressbees: require('../providers/xpressbees/xpressbeesCredentialSchema'),
  ecomexpress: require('../providers/ecomexpress/ecomExpressCredentialSchema'),
  shadowfax: require('../providers/shadowfax/shadowfaxCredentialSchema'),
};

const createProviderSchema = Joi.object({
  provider_key: Joi.string()
    .pattern(/^[a-z0-9_]+$/)
    .required()
    .custom((value, helpers) => {
      const keys = Object.keys(registry);
      if (!keys.includes(value)) {
        return helpers.message(`Provider key must be one of the registered adapters: ${keys.join(', ')}`);
      }
      return value;
    }),
  display_name: Joi.string().min(2).max(100).required(),
  logo_url: Joi.string().max(1000).allow(null, ''),
  credentials: Joi.object().required().custom((value, helpers) => {
    const providerKey = helpers.state.ancestors[0].provider_key;
    const schema = credentialsSchemaMap[providerKey];
    if (!schema) {
      // Fallback passthrough for unregistered schemas to be extensible
      return value;
    }
    const { error } = schema.validate(value);
    if (error) {
      return helpers.message(`Credentials validation failed: ${error.message}`);
    }
    return value;
  }),
  config: Joi.object().optional().default({}),
  supports_cod: Joi.boolean().optional().default(true),
  supports_prepaid: Joi.boolean().optional().default(true),
  max_weight_kg: Joi.number().positive().precision(2).allow(null),
  service_types: Joi.array()
    .items(Joi.string().valid('surface', 'air', 'express'))
    .min(1)
    .required(),
  priority: Joi.number().integer().optional().default(0),
});

const updateProviderSchema = Joi.object({
  display_name: Joi.string().min(2).max(100).optional(),
  logo_url: Joi.string().max(1000).allow(null, ''),
  credentials: Joi.object().optional().custom((value, helpers) => {
    // Determine providerKey from state or DB. Since update doesn't pass provider_key in body,
    // we'll validate against standard schemas if possible. In controllers we will check it as well.
    // Here we'll just check if it's a valid object, and the service will handle detailed checks.
    return value;
  }),
  config: Joi.object().optional(),
  supports_cod: Joi.boolean().optional(),
  supports_prepaid: Joi.boolean().optional(),
  max_weight_kg: Joi.number().positive().precision(2).allow(null),
  service_types: Joi.array().items(Joi.string().valid('surface', 'air', 'express')).min(1).optional(),
  priority: Joi.number().integer().optional(),
});

const grantAccessSchema = Joi.object({
  tenant_id: Joi.string().uuid().required(),
});

module.exports = {
  createProviderSchema,
  updateProviderSchema,
  grantAccessSchema,
  credentialsSchemaMap,
};
