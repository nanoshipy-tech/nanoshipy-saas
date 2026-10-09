'use strict';

const WhatsAppProviderPort = require('./whatsappProviderPort.interface');
const axios = require('axios');
const logger = require('../../utils/logger');

class InteraktAdapter extends WhatsAppProviderPort {
  constructor() {
    super();
    this.apiKey = process.env.INTERAKT_API_KEY;
    this.baseUrl = 'https://api.interakt.ai/v1/public';
  }

  async sendTemplateMessage({ to, templateName, language = 'en', variables = [], buttons = [] }) {
    logger.info(`[InteraktAdapter] Sending template message "${templateName}" to ${to}`);
    
    if (!this.apiKey) {
      logger.warn('[InteraktAdapter] INTERAKT_API_KEY not set. Simulating successful send.');
      return { messageId: `mock_interakt_${Date.now()}`, status: 'submitted' };
    }

    // Split phone number into country code + raw number (assumes +91 for India)
    let countryCode = '+91';
    let phoneNumber = to;
    if (to.startsWith('+')) {
      // Find space or extract first 3 chars
      countryCode = to.substring(0, 3);
      phoneNumber = to.substring(3);
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/message/`,
        {
          countryCode,
          phoneNumber,
          type: 'Template',
          template: {
            name: templateName,
            languageCode: language,
            bodyValues: variables,
          },
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const messageId = response.data?.data?.id || `interakt_${Date.now()}`;
      return { messageId, status: 'submitted' };
    } catch (err) {
      logger.error(`[InteraktAdapter] Failed to send message: ${err.message}`, err.response?.data);
      throw err;
    }
  }

  async getMessageStatus(messageId) {
    if (!this.apiKey || messageId.startsWith('mock_')) {
      return { status: 'delivered', delivered_at: new Date(), read_at: new Date() };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/message/${messageId}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(this.apiKey).toString('base64')}`,
        },
      });

      const msg = response.data?.data;
      return {
        status: msg?.status || 'unknown',
        delivered_at: msg?.delivered_at ? new Date(msg.delivered_at) : null,
        read_at: msg?.read_at ? new Date(msg.read_at) : null,
      };
    } catch (err) {
      logger.error(`[InteraktAdapter] Failed to check status for ${messageId}: ${err.message}`);
      return { status: 'failed' };
    }
  }

  async handleInboundWebhook(rawPayload, headers) {
    // Interakt webhook format parser
    // Returns normalized schema: { from, type, body, buttonPayload }
    const event = rawPayload?.data;
    if (!event) return null;

    return {
      from: event.customer?.phone_number || event.message?.from,
      type: event.message?.type || 'text',
      body: event.message?.text || event.message?.body,
      buttonPayload: event.message?.interactive?.button_reply?.id || null,
    };
  }
}

module.exports = new InteraktAdapter();
