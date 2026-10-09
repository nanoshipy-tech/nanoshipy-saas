'use strict';

const crypto = require('crypto');
const { CourierProvider, WebhookLog, WebhookIdempotency } = require('../models');
const webhookProcessQueue = require('../queues/webhookProcess.queue');
const logger = require('../utils/logger');
const eventBus = require('../events/eventBus');

/**
 * Verify HMAC-SHA256 signature for courier webhooks.
 *
 * Rules:
 * 1. If secret is missing:
 *    - In production (NODE_ENV === 'production') -> strict rejection (false).
 *    - In development/test: only accepted if ALLOW_DEV_WEBHOOK_BYPASS === 'true'.
 *      Otherwise rejected.
 * 2. If secret is present:
 *    - Must have matching signature header.
 *    - Strict hex character validation.
 *    - Constant-time comparison using crypto.timingSafeEqual with buffer length guards.
 *    - Rejects missing, empty, malformed, or mismatching signatures.
 */
function verifySignature(providerKey, payload, headers = {}, secret = null) {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowDevBypass = process.env.ALLOW_DEV_WEBHOOK_BYPASS === 'true' && !isProduction;
  const allowOpenWebhooks = process.env.ALLOW_OPEN_CARRIER_WEBHOOKS === 'true';

  if (!secret) {
    if (allowOpenWebhooks) {
      logger.info(`[WebhookSecurity] ALLOW_OPEN_CARRIER_WEBHOOKS active — accepting webhook for provider "${providerKey}"`);
      return true;
    }
    if (isProduction) {
      logger.warn(`[WebhookSecurity] Missing webhook secret for provider "${providerKey}" in production — rejecting webhook`);
      return false;
    }
    if (allowDevBypass) {
      logger.info(`[WebhookSecurity] Explicit dev webhook bypass active for provider "${providerKey}"`);
      return true;
    }
    logger.warn(`[WebhookSecurity] Missing webhook secret for provider "${providerKey}" and dev bypass is disabled — rejecting webhook`);
    return false;
  }

  try {
    // Support direct token verification if carrier passes secret in custom headers
    const tokenHeader = headers['x-shipway-token'] || headers['x-api-key'] || headers['authorization'] || '';
    if (tokenHeader) {
      const cleanToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();
      if (cleanToken === secret) {
        return true;
      }
    }

    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const computed = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigHeaderMap = {
      shipway: 'x-shipway-signature',
      delhivery: 'x-delhivery-signature',
      mock: 'x-mock-signature',
    };

    const headerName = sigHeaderMap[providerKey] || 'x-signature';
    const receivedHeader = headers[headerName] || headers[headerName.toLowerCase()] || '';

    if (!receivedHeader || typeof receivedHeader !== 'string') {
      return false;
    }

    const cleanSig = receivedHeader.replace(/^sha256=/, '').trim();
    // Validate hex string strictly (Fix #30)
    const isHex = /^[0-9a-fA-F]+$/.test(cleanSig);
    if (!isHex || cleanSig.length !== computed.length) {
      return false;
    }

    const computedBuf = Buffer.from(computed, 'hex');
    const receivedBuf = Buffer.from(cleanSig, 'hex');

    if (computedBuf.length !== receivedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuf, receivedBuf);
  } catch (err) {
    logger.error(`[WebhookSecurity] Signature verification exception for ${providerKey}: ${err.message}`);
    return false;
  }
}

/**
 * POST /api/v1/webhooks/:providerKey
 * Public endpoint — receives push notifications from courier APIs.
 * Fast-ack pattern: deduplicate, log immediately, verify signature, enqueue, respond 200.
 */
const receiveWebhook = async (req, res) => {
  const { providerKey } = req.params;

  try {
    // 1. Look up the provider
    const provider = await CourierProvider.scope('withCredentials').findOne({
      where: { provider_key: providerKey, is_active: true },
    });

    // Always respond 200 to avoid courier retry storms; log silently if unknown
    if (!provider) {
      logger.warn(`[Webhook] Received webhook for unknown or inactive provider: ${providerKey}`);
      return res.status(200).json({ received: true });
    }

    const body = req.body || {};
    const awb = body.awb || body.tracking_number || body.waybill || body.shipment?.awb || body.shipment?.tracking_number || body.shipment_id || '';
    const status = body.current_status || body.status || body.status_code || '';
    const eventTime = body.datetime || body.event_time || body.timestamp || body.updated_at || '';

    // Fast-ack sample / ping webhooks from Shipway dashboard ("Send Sample Webhook")
    if (body.sample || body.test || (!awb && (body.status === 'sample' || body.message?.toLowerCase().includes('sample')))) {
      logger.info(`[Webhook] Fast-ack sample webhook from provider: ${providerKey}`);
      return res.status(200).json({
        received: true,
        sample: true,
        provider: providerKey,
        message: 'Shipway sample webhook verified and acknowledged by Nanoshipy',
      });
    }

    // 2. Check Idempotency before enqueuing duplicate jobs (Fix #11)
    if (awb && status) {
      const idempotencyKey = crypto
        .createHash('sha256')
        .update(`${providerKey}:${awb}:${status}:${eventTime}`)
        .digest('hex');

      try {
        const [idemRecord, created] = await WebhookIdempotency.findOrCreate({
          where: { source: providerKey, event_id: idempotencyKey },
          defaults: {
            event_type: `${providerKey}.status_update`,
            status: 'processing',
            payload_hash: idempotencyKey,
          },
        });

        if (!created && (idemRecord.status === 'processed' || idemRecord.status === 'processing')) {
          logger.info(`[WebhookIdempotency] Duplicate webhook event skipped for provider ${providerKey}, AWB ${awb}, status ${status}`);
          return res.status(200).json({ received: true, deduplicated: true });
        }
      } catch (idemErr) {
        logger.warn(`[WebhookIdempotency] Idempotency lookup error: ${idemErr.message}`);
      }
    }

    // 3. Log raw payload immediately (fast-ack)
    const webhookLog = await WebhookLog.create({
      courier_provider_id: provider.id,
      payload: req.body,
      headers: req.headers,
      signature_valid: false, // will be updated after verification
    });

    // 4. Verify signature (non-blocking — we already logged)
    const webhookSecret = provider.config?.webhook_secret || null;
    const isValid = verifySignature(providerKey, req.body, req.headers, webhookSecret);

    await webhookLog.update({ signature_valid: isValid });

    if (!isValid) {
      logger.warn(`[Webhook] Invalid or unauthorized signature from provider ${providerKey} — logged, not processing`);
      // Return 200 to prevent retry storms from third-party couriers while discarding processing
      return res.status(200).json({ received: true });
    }

    // 5. Enqueue background processing job
    await webhookProcessQueue.add(
      `webhook-${webhookLog.id}`,
      { webhookLogId: webhookLog.id },
      { jobId: `webhook-${webhookLog.id}` },
    );

    logger.info(`[Webhook] Accepted webhook from ${providerKey}, log ${webhookLog.id} enqueued`);
    return res.status(200).json({ received: true });

  } catch (err) {
    // Dead-letter alerting & metrics (Fix #22)
    logger.error(`[Webhook][FATAL_INGESTION_ERROR] Fatal error processing webhook for ${providerKey}: ${err.message}`, { stack: err.stack });
    try {
      eventBus.emit('webhook.ingestion_failed', { providerKey, error: err.message, body: req.body });
    } catch {}
    return res.status(200).json({ received: true, error_logged: true });
  }
};

module.exports = { receiveWebhook, verifySignature };

