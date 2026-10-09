const Joi = require('joi');

const VALID_EVENTS = [
  'order.created',
  'order.status_changed',
  'shipment.created',
  'shipment.cancelled',
  'tracking.status_changed',
  'ndr.created',
  'ndr.action_taken',
  'rto.initiated',
  'wallet.low_balance',
];

const createWebhookSchema = Joi.object({
  target_url: Joi.string().uri({ scheme: ['https'] }).required()
    .messages({
      'string.uriCustomScheme': 'Webhook target_url must be a valid HTTPS URL for security reasons.'
    }),
  subscribed_events: Joi.array().items(Joi.string().valid(...VALID_EVENTS)).required().min(1),
});

const updateWebhookSchema = Joi.object({
  target_url: Joi.string().uri({ scheme: ['https'] }),
  subscribed_events: Joi.array().items(Joi.string().valid(...VALID_EVENTS)).min(1),
  is_active: Joi.boolean(),
}).min(1);

module.exports = {
  createWebhookSchema,
  updateWebhookSchema,
};
