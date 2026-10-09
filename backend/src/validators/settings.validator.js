'use strict';

const Joi = require('joi');

// ─────────────────────────────────────────────
// Tenant Settings
// ─────────────────────────────────────────────

/**
 * All fields are optional — send only what you want to change.
 * Sending null explicitly clears the override (reverts to platform default).
 */
const updateTenantSettingsSchema = Joi.object({
  invoice_prefix: Joi.string()
    .alphanum()
    .min(2)
    .max(20)
    .uppercase()
    .allow(null)
    .optional()
    .messages({
      'string.alphanum': 'Invoice prefix must be alphanumeric only',
      'string.min': 'Invoice prefix must be at least 2 characters',
      'string.max': 'Invoice prefix cannot exceed 20 characters',
    }),

  order_prefix: Joi.string()
    .min(1)
    .max(20)
    .allow(null, '')
    .optional(),

  label_prefix: Joi.string()
    .min(1)
    .max(20)
    .allow(null, '')
    .optional(),

  awb_prefix: Joi.string()
    .min(1)
    .max(20)
    .allow(null, '')
    .optional(),

  default_label_format: Joi.string()
    .valid('4x6', '4x4', '3x5', 'a4', 'a4_4in1', 'a4_2in1', 'a6')
    .allow(null)
    .optional(),

  label_logo_url: Joi.string()
    .uri()
    .allow(null, '')
    .optional(),

  ndr_auto_rto_threshold: Joi.number()
    .integer()
    .min(1)
    .max(10)
    .allow(null)
    .optional()
    .messages({
      'number.min': 'NDR threshold must be at least 1',
      'number.max': 'NDR threshold cannot exceed 10',
    }),

  default_pickup_address_id: Joi.string()
    .uuid()
    .allow(null)
    .optional(),

  low_balance_threshold: Joi.number()
    .positive()
    .precision(2)
    .allow(null)
    .optional()
    .messages({
      'number.positive': 'Low balance threshold must be a positive number',
    }),
}).min(1).messages({
  'object.min': 'At least one setting must be provided',
});

// ─────────────────────────────────────────────
// Platform Settings
// ─────────────────────────────────────────────

/**
 * Platform setting update — value is always a string in the request body,
 * the service validates against the declared value_type.
 */
const updatePlatformSettingSchema = Joi.object({
  setting_value: Joi.string().required().messages({
    'any.required': 'setting_value is required',
  }),
});

module.exports = {
  updateTenantSettingsSchema,
  updatePlatformSettingSchema,
};
