'use strict';

const logger = require('../../utils/logger');
const NotificationChannel = require('../base/NotificationChannel.interface');
const axios = require('axios');

class WhatsappChannel extends NotificationChannel {
  async send({ recipient, subject, body, metadata }) {
    try {
      const apiKey = process.env.WHATSAPP_BSP_API_KEY;
      const sourceNumber = process.env.WHATSAPP_BSP_SOURCE_NUMBER || '919876543210';
      const templateName = metadata?.meta_template_name;

      logger.info(`[WhatsAppChannel] Preparing WhatsApp message to: ${recipient}. templateName: ${templateName || 'None'}`);

      if (apiKey) {
        // Gupshup/BSP API integration
        const response = await axios.post('https://api.gupshup.io/sm/api/v1/msg', new URLSearchParams({
          channel: 'whatsapp',
          source: sourceNumber,
          destination: recipient,
          message: JSON.stringify({
            type: 'text',
            text: body,
          }),
          // In real BSPs we send the approved template variables
        }), {
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

        return {
          success: true,
          providerMessageId: response.data?.messageId || 'gupshup-msg-id',
          error: null,
        };
      } else {
        // Sandbox/Mock Mode
        logger.info(`[WhatsAppChannel] Sandbox Mock WhatsApp dispatched successfully to ${recipient}`);
        return {
          success: true,
          providerMessageId: `mock-wa-${Date.now()}`,
          error: null,
        };
      }
    } catch (err) {
      logger.error(`[WhatsAppChannel] Dispatch failed to ${recipient}: ${err.message}`);
      return {
        success: false,
        providerMessageId: null,
        error: err.message,
      };
    }
  }
}

module.exports = WhatsappChannel;
