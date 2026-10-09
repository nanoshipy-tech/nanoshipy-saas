const express = require('express');
const shopifyConnectorService = require('../services/shopifyConnector.service');
const woocommerceConnectorService = require('../services/woocommerceConnector.service');
const storefrontConnectionRepo = require('../repositories/storefrontConnection.repository');
const logger = require('../utils/logger');

const router = express.Router();

const processStoreWebhook = async (res, connection, platform, topic, payload) => {
  try {
    const externalOrderId = String(payload?.id || payload?.order_id || payload?.number || '');
    const eventId = `${platform}_${connection.id}_${externalOrderId}_${topic}`;

    // Database-level Webhook Idempotency guard
    const { WebhookIdempotency } = require('../models');
    if (externalOrderId) {
      const [record, created] = await WebhookIdempotency.findOrCreate({
        where: {
          source: platform,
          event_id: eventId,
        },
        defaults: {
          event_type: topic,
          status: 'queued',
        },
      });

      if (!created && record.status === 'processed') {
        logger.info(`[StorefrontWebhook] Event already processed: ${eventId}`);
        if (!res.headersSent) {
          return res.status(200).json({ received: true, deduplicated: true });
        }
        return;
      }
    }

    const jobId = `storefront-order-${connection.id}-${externalOrderId || Date.now()}`;
    const { Queue } = require('bullmq');
    const { getRedisClient } = require('../config/redis.config');
    const queue = new Queue('storefront-webhook-process', { connection: getRedisClient() });
    await queue.add('store-webhook', { connectionId: connection.id, platform, topic, payload, externalOrderId }, { jobId });
    
    if (!res.headersSent) {
      return res.status(200).json({ received: true });
    }
  } catch (err) {
    logger.error(`[StorefrontWebhook] Failed to enqueue webhook job for connection ${connection.id}: ${err.message}`, { error: err });
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to process webhook' });
    }
  }
};

// Shopify inbound webhook
router.post('/shopify/:connectionId', express.raw({ type: '*/*' }), async (req, res, next) => {
  try {
    const connection = await storefrontConnectionRepo.findById(req.params.connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const rawBody = req.body;
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    if (!shopifyConnectorService.verifyWebhookSignature(rawBody, hmacHeader, connection.webhook_secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const topic = req.query.topic || req.headers['x-shopify-topic'];
    await processStoreWebhook(res, connection, 'shopify', topic, payload);
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      logger.error(`[StorefrontWebhook] Unhandled error after response sent: ${err.message}`);
    }
  }
});

// WooCommerce inbound webhook
router.post('/woocommerce/:connectionId', express.raw({ type: '*/*' }), async (req, res, next) => {
  try {
    const connection = await storefrontConnectionRepo.findById(req.params.connectionId);
    if (!connection) return res.status(404).json({ error: 'Connection not found' });

    const rawBody = req.body;
    const sigHeader = req.headers['x-wc-webhook-signature'];
    if (!woocommerceConnectorService.verifyWebhookSignature(rawBody, sigHeader, connection.webhook_secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const topic = req.query.topic || req.headers['x-wc-webhook-topic'];
    await processStoreWebhook(res, connection, 'woocommerce', topic, payload);
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      logger.error(`[StorefrontWebhook] Unhandled error after response sent: ${err.message}`);
    }
  }
});

module.exports = router;
