'use strict';

/**
 * WhatsApp Provider Port Interface contract.
 * All adapters (Interakt, Gupshup) must implement this interface.
 */
class WhatsAppProviderPort {
  async sendTemplateMessage({ to, templateName, language, variables, buttons }) {
    throw new Error('Not implemented');
  }

  async getMessageStatus(messageId) {
    throw new Error('Not implemented');
  }

  async handleInboundWebhook(rawPayload, headers) {
    throw new Error('Not implemented');
  }
}

module.exports = WhatsAppProviderPort;
