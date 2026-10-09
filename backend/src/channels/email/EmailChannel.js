'use strict';

const nodemailer = require('nodemailer');
const config = require('../../config/env');
const logger = require('../../utils/logger');
const NotificationChannel = require('../base/NotificationChannel.interface');

class EmailChannel extends NotificationChannel {
  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: config.email?.host || 'smtp.ethereal.email',
      port: config.email?.port || 587,
      secure: config.email?.port === 465,
      auth: {
        user: config.email?.user || '',
        pass: config.email?.password || '',
      },
    });
  }

  async send({ recipient, subject, body, metadata }) {
    try {
      if (!config.email?.user || !config.email?.password) {
        logger.info(`[EmailChannel] Sandbox Mock Email dispatched successfully to ${recipient}. Subject: "${subject}"`);
        return {
          success: true,
          providerMessageId: `mock-email-${Date.now()}`,
          error: null,
        };
      }

      const info = await this.transporter.sendMail({
        from: config.email?.from || '"ShippingSaaS" <no-reply@shippingsaas.com>',
        to: recipient,
        subject: subject || 'Notification Update',
        html: body,
      });

      return {
        success: true,
        providerMessageId: info.messageId,
        error: null,
      };
    } catch (err) {
      logger.error(`[EmailChannel] Failed to dispatch email to ${recipient}: ${err.message}`);
      return {
        success: false,
        providerMessageId: null,
        error: err.message,
      };
    }
  }
}

module.exports = EmailChannel;
