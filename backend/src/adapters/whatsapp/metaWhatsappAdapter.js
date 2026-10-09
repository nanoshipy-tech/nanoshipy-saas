'use strict';

const axios = require('axios');
const logger = require('../../utils/logger');
const settingsService = require('../../services/settings.service');

/**
 * Direct Official Meta WhatsApp Business Cloud API Adapter
 * Graph API Version: v19.0
 */
class MetaWhatsAppAdapter {
  constructor() {
    this.graphApiVersion = 'v19.0';
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
  }

  /**
   * Fetch current WhatsApp Cloud API settings from database or environment.
   */
  async getCredentials() {
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    let wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    let verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nanoshipy_wa_secret';

    try {
      const settings = await settingsService.getPlatformSettings();
      const map = {};
      settings.forEach(s => { map[s.setting_key] = s.setting_value; });

      if (map['whatsapp_phone_number_id']) phoneNumberId = map['whatsapp_phone_number_id'];
      if (map['whatsapp_business_account_id']) wabaId = map['whatsapp_business_account_id'];
      if (map['whatsapp_access_token']) accessToken = map['whatsapp_access_token'];
      if (map['whatsapp_verify_token']) verifyToken = map['whatsapp_verify_token'];
    } catch (err) {
      logger.warn(`[MetaWhatsAppAdapter] Error fetching DB credentials: ${err.message}`);
    }

    return { phoneNumberId, wabaId, accessToken, verifyToken };
  }

  /**
   * Verify credentials against Meta Graph API
   */
  async verifyConnection() {
    const { phoneNumberId, accessToken } = await this.getCredentials();

    if (!phoneNumberId || !accessToken) {
      return { success: false, message: 'Phone Number ID and Access Token are required.' };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8000,
      });

      if (response.data && response.data.id) {
        return {
          success: true,
          display_phone_number: response.data.display_phone_number || response.data.id,
          verified_name: response.data.verified_name || 'Verified',
          quality_rating: response.data.quality_rating || 'GREEN',
        };
      }

      return { success: false, message: 'Invalid Meta Graph API response.' };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error(`[MetaWhatsAppAdapter] Verification failed: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * Send a template or text message via official Meta WhatsApp Cloud API
   */
  async sendTemplateMessage({ to, templateName, language = 'en_US', variables = [], text = null }) {
    const { phoneNumberId, accessToken } = await this.getCredentials();

    if (!phoneNumberId || !accessToken) {
      throw new Error('Meta WhatsApp Cloud API credentials missing.');
    }

    // Format phone number to E.164 without '+' (e.g. 919876543210)
    let formattedTo = String(to).replace(/\D/g, '');
    if (formattedTo.length === 10) formattedTo = `91${formattedTo}`;

    const url = `${this.baseUrl}/${phoneNumberId}/messages`;

    let payload;
    if (text) {
      // Plain text message
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'text',
        text: { body: text },
      };
    } else {
      // Template message
      const components = [];
      if (variables && variables.length > 0) {
        components.push({
          type: 'body',
          parameters: variables.map(v => ({ type: 'text', text: String(v) })),
        });
      }

      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components,
        },
      };
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const messageId = response.data?.messages?.[0]?.id;
      logger.info(`[MetaWhatsAppAdapter] Message sent to ${formattedTo}. Message ID: ${messageId}`);
      return { success: true, messageId, data: response.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error(`[MetaWhatsAppAdapter] Send message failed to ${formattedTo}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }
}

module.exports = new MetaWhatsAppAdapter();
