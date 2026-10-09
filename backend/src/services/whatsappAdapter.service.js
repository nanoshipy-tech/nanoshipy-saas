'use strict';

const metaWhatsappAdapter = require('../adapters/whatsapp/metaWhatsappAdapter');
const whatsappMessagingService = require('./whatsappMessaging.service');
const logger = require('../utils/logger');

class WhatsAppAdapterService {
  constructor() {
    logger.info('[WhatsAppAdapterService] Initialized Multi-BSP WhatsApp Service (Meta Cloud, Interakt, Gupshup).');
    this.adapter = metaWhatsappAdapter;
  }

  async sendTemplateMessage({ to, templateName, language, variables, buttons, text }) {
    try {
      // First try configured BSP in database (Meta Cloud, Interakt, Gupshup)
      const res = await whatsappMessagingService.sendTemplate({
        to,
        templateName: templateName || 'shipping_update',
        languageCode: language || 'en',
        parameters: variables || [],
      });
      if (res && res.success) return res;
      if (res && res.reason !== 'NO_BSP_CONFIGURED') return res;
    } catch (bspErr) {
      logger.warn(`[WhatsAppAdapterService] DB BSP send failed: ${bspErr.message}. Falling back to Meta adapter.`);
    }

    // Fallback to metaWhatsappAdapter using platform_settings or env
    return this.adapter.sendTemplateMessage({ to, templateName, language, variables, buttons, text });
  }

  async verifyConnection() {
    return this.adapter.verifyConnection();
  }
}

module.exports = new WhatsAppAdapterService();

