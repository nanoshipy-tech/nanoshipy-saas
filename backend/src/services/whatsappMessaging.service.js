'use strict';

const axios = require('axios');
const whatsappBspService = require('./whatsappBspConfig.service');
const { NotificationLog } = require('../models');
const logger = require('../utils/logger');

class WhatsappMessagingService {
  /**
   * Format Indian mobile number to E.164 without leading plus
   */
  static formatPhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      // already valid
    } else if (cleaned.startsWith('0')) {
      cleaned = '91' + cleaned.slice(1);
    }
    return cleaned;
  }

  /**
   * Send WhatsApp template message using configured BSP
   */
  static async sendTemplate({ to, templateName, languageCode = 'en', parameters = [], mediaUrl = null, notificationLogId = null }) {
    const activeConfig = await whatsappBspService.getActiveConfig();
    if (!activeConfig || !activeConfig.apiKey) {
      logger.warn(`[WhatsappMessaging] No active WhatsApp BSP configured. Message to ${to} dropped.`);
      return { success: false, reason: 'NO_BSP_CONFIGURED' };
    }

    const recipient = this.formatPhoneNumber(to);
    const { bsp, apiKey, phoneNumberId } = activeConfig;

    logger.info(`[WhatsappMessaging] Dispatching template "${templateName}" to ${recipient} via ${bsp}`);

    try {
      let response;
      if (bsp === 'meta_cloud') {
        const components = [];
        if (parameters && parameters.length > 0) {
          components.push({
            type: 'body',
            parameters: parameters.map(p => ({
              type: 'text',
              text: String(p),
            })),
          });
        }
        if (mediaUrl) {
          components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: mediaUrl } }],
          });
        }

        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: components.length > 0 ? components : undefined,
          },
        };

        response = await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
      } else if (bsp === 'interakt') {
        const payload = {
          countryCode: '+91',
          phoneNumber: recipient.startsWith('91') ? recipient.slice(2) : recipient,
          type: 'Template',
          template: {
            name: templateName,
            languageCode: languageCode,
            bodyValues: parameters.map(p => String(p)),
          },
        };

        response = await axios.post(
          'https://api.interakt.ai/v1/public/message/',
          payload,
          {
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
      } else if (bsp === 'gupshup') {
        const payload = {
          channel: 'whatsapp',
          source: phoneNumberId || 'Nanoshipy',
          destination: recipient,
          'src.name': 'Nanoshipy',
          template: JSON.stringify({
            id: templateName,
            params: parameters.map(p => String(p)),
          }),
        };

        response = await axios.post(
          'https://api.gupshup.io/sm/api/v1/template/msg',
          new URLSearchParams(payload).toString(),
          {
            headers: {
              apikey: apiKey,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
          }
        );
      }

      const messageId = response?.data?.messages?.[0]?.id || response?.data?.id || 'sent';

      if (notificationLogId) {
        await NotificationLog.update(
          {
            status: 'sent',
            metadata: { messageId, bsp, response: response?.data },
          },
          { where: { id: notificationLogId } }
        ).catch(() => {});
      }

      return { success: true, messageId, data: response?.data };
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || err.message;
      logger.error(`[WhatsappMessaging] Failed to send template via ${bsp}: ${errorMsg}`, {
        status: err.response?.status,
        data: err.response?.data,
      });

      if (notificationLogId) {
        await NotificationLog.update(
          {
            status: 'failed',
            error_message: errorMsg,
          },
          { where: { id: notificationLogId } }
        ).catch(() => {});
      }

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Send custom text message
   */
  static async sendTextMessage(toOrObj, maybeText) {
    let to;
    let text;
    if (typeof toOrObj === 'object' && toOrObj !== null) {
      to = toOrObj.to || toOrObj.recipientPhone || toOrObj.phone || toOrObj.recipient;
      text = toOrObj.text || toOrObj.message || toOrObj.body;
    } else {
      to = toOrObj;
      text = maybeText;
    }

    const activeConfig = await whatsappBspService.getActiveConfig();
    if (!activeConfig || !activeConfig.apiKey) {
      logger.warn(`[WhatsappMessaging] No active WhatsApp BSP configured for text to ${to}`);
      return { success: false, reason: 'NO_BSP_CONFIGURED' };
    }

    const recipient = this.formatPhoneNumber(to);
    const { bsp, apiKey, phoneNumberId } = activeConfig;

    try {
      let response;
      if (bsp === 'meta_cloud') {
        response = await axios.post(
          `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
          {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient,
            type: 'text',
            text: { body: text },
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
      } else if (bsp === 'interakt') {
        response = await axios.post(
          'https://api.interakt.ai/v1/public/message/',
          {
            countryCode: '+91',
            phoneNumber: recipient.startsWith('91') ? recipient.slice(2) : recipient,
            type: 'Text',
            text: { body: text },
          },
          {
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey).toString('base64')}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
      }

      return { success: true, data: response?.data };
    } catch (err) {
      logger.error(`[WhatsappMessaging] Failed to send text message: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

module.exports = WhatsappMessagingService;
