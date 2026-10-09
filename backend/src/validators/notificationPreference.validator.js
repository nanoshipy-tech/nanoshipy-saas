'use strict';

const Joi = require('joi');
const { KNOWN_EVENTS } = require('../services/notificationPreference.service');

const updatePreferencesSchema = Joi.object({
  preferences: Joi.array().items(
    Joi.object({
      event_key: Joi.string().valid(...KNOWN_EVENTS).required(),
      channel: Joi.string().valid('email', 'sms', 'whatsapp').required(),
      is_enabled: Joi.boolean().required(),
    })
  ).required(),
});

module.exports = {
  updatePreferencesSchema,
};
