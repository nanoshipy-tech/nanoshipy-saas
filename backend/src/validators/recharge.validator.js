'use strict';

const Joi = require('joi');

const rechargeSchema = Joi.object({
  amount: Joi.number()
    .precision(2)
    .positive()
    .min(100)
    .max(500000)
    .required()
    .messages({
      'number.min': 'Minimum recharge amount is ₹100',
      'number.max': 'Maximum recharge amount per transaction is ₹5,00,000',
    }),
});

const verifySchema = Joi.object({
  recharge_order_id: Joi.string().uuid().required(),
  gateway_payment_id: Joi.string().min(1).required(),
  gateway_signature: Joi.string().min(1).required(),
});

const thresholdSchema = Joi.object({
  low_balance_threshold: Joi.number().precision(2).min(0).required(),
});

const manualCreditSchema = Joi.object({
  amount: Joi.number().precision(2).positive().required(),
  description: Joi.string().min(10).required().messages({
    'string.min': 'Description must be at least 10 characters for auditing accountability',
  }),
});

module.exports = {
  rechargeSchema,
  verifySchema,
  thresholdSchema,
  manualCreditSchema,
};
