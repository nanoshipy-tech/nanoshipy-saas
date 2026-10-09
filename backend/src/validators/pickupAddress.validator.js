const Joi = require('joi');
const { isValidIndianPincode } = require('../utils/pincode.util');

const pincodeValidator = (value, helpers) => {
  if (!isValidIndianPincode(value)) {
    return helpers.message('Must be a 6-digit number');
  }
  return value;
};

const createAddressSchema = Joi.object({
  label: Joi.string().min(1).max(100).required(),
  contact_name: Joi.string().max(100).required(),
  contact_phone: Joi.string().max(20).required(), // Add E.164 pattern in future if needed
  address_line1: Joi.string().max(255).required(),
  address_line2: Joi.string().max(255).optional().allow('', null),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).required(),
  pincode: Joi.string().custom(pincodeValidator).required(),
  country: Joi.string().max(100).optional().default('India').allow('', null),
  address_source: Joi.string().optional().allow('', null),
  pincode_verified: Joi.boolean().optional().default(false),
  is_default: Joi.boolean().optional().default(false),
  verification_status: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  shipway_location_id: Joi.string().max(100).optional().allow('', null),
}).unknown(true);

const updateAddressSchema = Joi.object({
  label: Joi.string().min(1).max(100).optional(),
  contact_name: Joi.string().max(100).optional(),
  contact_phone: Joi.string().max(20).optional(),
  address_line1: Joi.string().max(255).optional(),
  address_line2: Joi.string().max(255).optional().allow('', null),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  pincode: Joi.string().custom(pincodeValidator).optional(),
  country: Joi.string().max(100).optional().allow('', null),
  address_source: Joi.string().optional().allow('', null),
  pincode_verified: Joi.boolean().optional(),
  is_default: Joi.boolean().optional(),
  verification_status: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  shipway_location_id: Joi.string().max(100).optional().allow('', null),
}).min(1).unknown(true);

const queryAddressesSchema = Joi.object({
  page: Joi.number().min(1).optional().default(1),
  limit: Joi.number().min(1).max(100).optional().default(20),
  search: Joi.string().optional().allow(''),
  city: Joi.string().optional().allow(''),
  state: Joi.string().optional().allow(''),
  is_default: Joi.boolean().optional(),
  sort: Joi.string().optional().default('created_at:desc'),
}).unknown(true);

module.exports = {
  createAddressSchema,
  updateAddressSchema,
  queryAddressesSchema,
};
