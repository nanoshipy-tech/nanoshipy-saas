'use strict';

const EmailChannel = require('./email/EmailChannel');
const SmsChannel = require('./sms/SmsChannel');
const WhatsappChannel = require('./whatsapp/WhatsappChannel');
const InAppChannel = require('./inapp/InAppChannel');

const registry = {
  email: EmailChannel,
  sms: SmsChannel,
  whatsapp: WhatsappChannel,
  inapp: InAppChannel,
};

module.exports = registry;
