'use strict';

const logger = require('../../utils/logger');
const NotificationChannel = require('../base/NotificationChannel.interface');
const axios = require('axios');

class SmsChannel extends NotificationChannel {
  async send({ recipient, subject, body, metadata }) {
    try {
      const authKey = process.env.MSG91_AUTH_KEY;
      const senderId = process.env.MSG91_SENDER_ID || 'SHPSSS';
      const dltTemplateId = process.env.MSG91_DLT_TEMPLATE_ID || metadata?.dlt_template_id;

      logger.info(`[SMSChannel] Preparing SMS send to: ${recipient}. Body: "${body}"`);

      if (authKey) {
        // Real MSG91 API Call (India DLT Compliant)
        const response = await axios.post('https://api.msg91.com/api/v5/flow/', {
          flow_id: dltTemplateId,
          sender: senderId,
          mobiles: recipient,
          // Extra variables interpolated in DLT templates can be passed here
        }, {
          headers: {
            authkey: authKey,
            'Content-Type': 'application/json',
          },
        });

        return {
          success: true,
          providerMessageId: response.data?.request_id || 'msg91-req-id',
          error: null,
        };
      } else {
        // Sandbox/Mock Mode
        logger.info(`[SMSChannel] Sandbox Mock SMS dispatched successfully to recipient: ${recipient}`);
        return {
          success: true,
          providerMessageId: `mock-sms-${Date.now()}`,
          error: null,
        };
      }
    } catch (err) {
      logger.error(`[SmsChannel] Dispatch failed to ${recipient}: ${err.message}`);
      return {
        success: false,
        providerMessageId: null,
        error: err.message,
      };
    }
  }
}

module.exports = SmsChannel;
