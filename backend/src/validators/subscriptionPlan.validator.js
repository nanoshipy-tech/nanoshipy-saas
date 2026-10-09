'use strict';

const Joi = require('joi');

const planSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  slug: Joi.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(50).required()
    .messages({ 'string.pattern.base': 'Slug must be lowercase and hyphen-separated (e.g. basic-plan)' }),
  price_monthly: Joi.number().min(0).precision(2).required(),
  price_yearly: Joi.number().min(0).precision(2).allow(null).optional(),
  max_orders_per_month: Joi.number().integer().min(1).allow(null).optional(),
  max_users: Joi.number().integer().min(1).allow(null).optional(),
  max_pickup_addresses: Joi.number().integer().min(1).allow(null).optional(),
  courier_access_tier: Joi.string().valid('basic', 'standard', 'all').default('basic'),
  support_tier: Joi.string().valid('email', 'priority', 'dedicated').default('email'),
  sort_order: Joi.number().integer().min(0).default(0),
});

const changePlanSchema = Joi.object({
  plan_id: Joi.string().uuid().required(),
  billing_cycle: Joi.string().valid('monthly', 'yearly').default('monthly'),
});

module.exports = {
  planSchema,
  changePlanSchema,
};
