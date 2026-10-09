'use strict';

const Joi = require('joi');

const createTicketSchema = Joi.object({
  subject: Joi.string().min(5).max(255).required(),
  category: Joi.string().valid('billing', 'technical', 'shipment_issue', 'account', 'other').required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  message: Joi.string().min(10).required(),
  related_shipment_id: Joi.string().trim().allow('', null),
  related_order_id: Joi.string().allow('', null),
  attachments: Joi.array().items(
    Joi.object({
      file_name: Joi.string().required(),
      file_url: Joi.string().required(),
      file_size_bytes: Joi.number().integer().max(10 * 1024 * 1024).required() // 10MB limit
    })
  ).max(5).allow(null)
});

const replyTicketSchema = Joi.object({
  message: Joi.string().min(1).required(),
  isInternalNote: Joi.boolean().default(false),
  attachments: Joi.array().items(
    Joi.object({
      file_name: Joi.string().required(),
      file_url: Joi.string().required(),
      file_size_bytes: Joi.number().integer().max(10 * 1024 * 1024).required()
    })
  ).max(5).allow(null)
});

const assignTicketSchema = Joi.object({
  assigned_to: Joi.string().uuid().required()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('open', 'in_progress', 'waiting_on_tenant', 'resolved', 'closed').allow(null),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').allow(null)
}).or('status', 'priority');

module.exports = {
  createTicketSchema,
  replyTicketSchema,
  assignTicketSchema,
  updateStatusSchema,
};
