'use strict';

const Joi = require('joi');

const createShipmentSchema = Joi.object({
  order_id: Joi.string().uuid().required(),
  courier_provider_id: Joi.string().uuid().optional().allow(null, ''),
  service_type: Joi.string().trim().max(100).default('express'),
  quoted_rate: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().pattern(/^\d+(\.\d+)?$/)
  ).optional().allow(null),
});

module.exports = {
  createShipmentSchema,
};

