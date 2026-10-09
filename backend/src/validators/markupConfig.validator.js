'use strict';

const Joi = require('joi');

const createMarkupSchema = Joi.object({
  scope: Joi.string().valid('global', 'seller', 'booking_office', 'courier', 'courier_zone', 'zone').default('global'),
  seller_id: Joi.string().uuid().allow(null, '').optional(),
  booking_office_id: Joi.string().uuid().allow(null, '').optional(),
  courier_provider_id: Joi.string().uuid().allow(null, '').optional(),
  zone: Joi.string().valid('A', 'B', 'C', 'D', 'E').allow(null, '').optional(),
  markup_percent: Joi.number().min(0).max(500).required(),
  flat_markup_amount: Joi.number().min(0).optional().default(0),
  name: Joi.string().max(255).allow(null, '').optional(),
  is_active: Joi.boolean().optional().default(true),
  effective_from: Joi.string().isoDate().optional(),
  effective_to: Joi.string().isoDate().allow(null, '').optional(),
}).unknown(true);

const updateMarkupSchema = Joi.object({
  scope: Joi.string().valid('global', 'seller', 'booking_office', 'courier', 'courier_zone', 'zone').optional(),
  seller_id: Joi.string().uuid().allow(null, '').optional(),
  booking_office_id: Joi.string().uuid().allow(null, '').optional(),
  courier_provider_id: Joi.string().uuid().allow(null, '').optional(),
  zone: Joi.string().valid('A', 'B', 'C', 'D', 'E').allow(null, '').optional(),
  markup_percent: Joi.number().min(0).max(500).optional(),
  flat_markup_amount: Joi.number().min(0).optional(),
  name: Joi.string().max(255).allow(null, '').optional(),
  is_active: Joi.boolean().optional(),
  effective_from: Joi.string().isoDate().optional(),
  effective_to: Joi.string().isoDate().allow(null, '').optional(),
}).unknown(true);

const updateCodRtoSchema = Joi.object({
  flat_charge: Joi.number().min(0).precision(2).optional(),
  percent_charge: Joi.number().min(0).max(100).precision(2).optional(),
  surcharge_percent: Joi.number().min(0).max(100).precision(2).optional(),
});

module.exports = {
  createMarkupSchema,
  updateMarkupSchema,
  updateCodRtoSchema,
};
