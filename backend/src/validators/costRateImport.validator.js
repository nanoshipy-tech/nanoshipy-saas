'use strict';

const Joi = require('joi');

const costRateQuerySchema = Joi.object({
  courier: Joi.string().allow('').optional(),
  mode: Joi.string().valid('air', 'surface').optional(),
  zone: Joi.string().valid('A', 'B', 'C', 'D', 'E').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
});

module.exports = {
  costRateQuerySchema,
};
