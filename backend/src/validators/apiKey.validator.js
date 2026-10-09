const Joi = require('joi');

const VALID_SCOPES = [
  'orders.read',
  'orders.write',
  'shipments.read',
  'shipments.write',
  'tracking.read',
  'read_only',
  'read_write',
];

const createApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  label: Joi.string().min(1).max(100).optional(),
  scopes: Joi.array().items(Joi.string().valid(...VALID_SCOPES)).optional(),
  scope: Joi.string().valid('read_only', 'read_write').optional(),
  sandbox_mode: Joi.boolean().optional().default(false),
  expires_at: Joi.date().iso().allow(null).optional(),
}).or('name', 'label');

module.exports = {
  createApiKeySchema,
};
