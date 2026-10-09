'use strict';

const Joi = require('joi');

const createRateCardSchema = Joi.object({
  courier_provider_id: Joi.string().uuid().allow(null).optional(),
  courier_display_name: Joi.string().min(2).max(100).required(),
  service_mode: Joi.string().valid('air', 'surface').default('surface'),
  base_weight_kg: Joi.number().positive().precision(2).default(0.50),
  additional_weight_increment_kg: Joi.number().positive().precision(2).default(0.50),
  zone: Joi.string().valid('A', 'B', 'C', 'D', 'E').required(),
  base_price: Joi.number().min(0).precision(2).required(),
  additional_price: Joi.number().min(0).precision(2).required(),
  is_active: Joi.boolean().default(true),
  effective_from: Joi.string().isoDate().optional(),
  effective_to: Joi.string().isoDate().allow(null).optional(),
});

const updateRateCardSchema = Joi.object({
  courier_display_name: Joi.string().min(2).max(100).optional(),
  service_mode: Joi.string().valid('air', 'surface').optional(),
  base_weight_kg: Joi.number().positive().precision(2).optional(),
  additional_weight_increment_kg: Joi.number().positive().precision(2).optional(),
  zone: Joi.string().valid('A', 'B', 'C', 'D', 'E').optional(),
  base_price: Joi.number().min(0).precision(2).optional(),
  additional_price: Joi.number().min(0).precision(2).optional(),
  is_active: Joi.boolean().optional(),
  effective_from: Joi.string().isoDate().optional(),
  effective_to: Joi.string().isoDate().allow(null).optional(),
});

module.exports = {
  createRateCardSchema,
  updateRateCardSchema,
};
