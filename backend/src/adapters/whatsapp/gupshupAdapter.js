'use strict';

const WhatsAppProviderPort = require('./whatsappProviderPort.interface');
const logger = require('../../utils/logger');

class GupshupAdapter extends WhatsAppProviderPort {
  async sendTemplateMessage({ to, templateName, language = 'en', variables = [], buttons = [] }) {
    logger.info(`[GupshupAdapter] [STUB] Sending template message "${templateName}" to ${to}`);
    return { messageId: `mock_gupshup_${Date.now()}`, status: 'submitted' };
  }

  async getMessageStatus(messageId) {
    logger.info(`[GupshupAdapter] [STUB] Checking status for message ${messageId}`);
    return { status: 'delivered', delivered_at: new Date(), read_at: new Date() };
  }

  async handleInboundWebhook(rawPayload, headers) {
    logger.info('[GupshupAdapter] [STUB] Parsing inbound webhook payload');
    return {
      from: rawPayload?.mobile || rawPayload?.sender?.phone,
      type: rawPayload?.type || 'text',
      body: rawPayload?.text || rawPayload?.payload?.text,
      buttonPayload: rawPayload?.payload?.postbackText || null,
    };
  }
}

module.exports = new GupshupAdapter();
