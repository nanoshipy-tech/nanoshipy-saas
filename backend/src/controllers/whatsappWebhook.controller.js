'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');

/**
 * GET /api/v1/whatsapp/webhook
 * Verification endpoint for WhatsApp Webhooks (Growax / Meta Webhook Handshake)
 */
exports.verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const settings = await settingsService.getPlatformSettings();
    const map = {};
    settings.forEach(s => { map[s.setting_key] = s.setting_value; });

    const { WhatsappBspConfig, NotificationLog } = require('../models');
    const bspConfig = await WhatsappBspConfig.findOne({ where: { status: 'connected' } }).catch(() => null);
    const bspVerifyToken = bspConfig?.webhook_verify_token;

    const configuredToken = bspVerifyToken || map['whatsapp_verify_token'] || process.env.WHATSAPP_VERIFY_TOKEN;
    const verifyToken = configuredToken || 'nanoshipy_wa_secret';

    if (mode && token) {
      if (mode === 'subscribe' && (token === verifyToken || (bspVerifyToken && token === bspVerifyToken))) {
        logger.info('[WhatsAppWebhook] Webhook subscription verified successfully');
        return res.status(200).send(challenge);
      } else {
        logger.warn('[WhatsAppWebhook] Webhook verification failed. Token mismatch.');
        return res.sendStatus(403);
      }
    }

    // Default response for ping check
    return res.status(200).json({ success: true, message: 'WhatsApp Webhook Endpoint active' });
  } catch (err) {
    logger.error('[WhatsAppWebhook] Verification error:', err);
    return res.status(200).send('OK');
  }
};

/**
 * POST /api/v1/whatsapp/webhook
 * Receiver endpoint for Growax CRM & Meta WhatsApp delivery receipts & inbound messages
 */
exports.handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    logger.info('[WhatsAppWebhook] Incoming Webhook Event received:', {
      event: payload?.event || payload?.type || 'unknown',
      sender: payload?.from || payload?.sender || payload?.receiver,
    });

    // Parse Meta Cloud status receipts if present
    const entry = payload?.entry?.[0];
    const changes = entry?.changes?.[0];
    const statuses = changes?.value?.statuses;

    if (Array.isArray(statuses) && statuses.length > 0) {
      const statusObj = statuses[0];
      const messageId = statusObj.id;
      const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
      const { NotificationLog } = require('../models');

      if (messageId && status) {
        logger.info(`[WhatsAppWebhook] Message status update: ${messageId} -> ${status}`);
        setImmediate(async () => {
          try {
            await NotificationLog.update(
              { status: status === 'read' ? 'delivered' : status },
              { where: { metadata: { messageId } } }
            );
          } catch (e) {}
        });
      }
    }

    // Acknowledge receipt to Meta / BSP
    return res.status(200).json({ success: true, status: 'RECEIVED' });
  } catch (err) {
    logger.error('[WhatsAppWebhook] Error handling webhook:', err);
    return res.status(200).json({ success: true, status: 'RECEIVED' });
  }
};
