'use strict';

const crypto = require('crypto');
const axios = require('axios');
const { WebhookEndpoint, WebhookDelivery } = require('../models');
const { validateWebhookUrl } = require('../utils/ssrfProtector.util');
const { generateTimestampedSignature } = require('../utils/webhookSigning.util');
const logger = require('../utils/logger');

// Retry backoff delays in milliseconds: 1m, 5m, 30m, 2h, 6h
const RETRY_DELAYS_MS = [60000, 300000, 1800000, 7200000, 21600000];

class WebhookDispatcherService {
  constructor() {
    this.emitWebhookEvent = this.emitWebhookEvent.bind(this);
    this.enqueueDelivery = this.enqueueDelivery.bind(this);
    this.executeDeliveryAttempt = this.executeDeliveryAttempt.bind(this);
    this.generateSecret = this.generateSecret.bind(this);
  }

  /**
   * Generates a secure webhook secret.
   */
  generateSecret() {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Emits an event to all subscribed endpoints for a tenant.
   * Runs deliveries asynchronously in background/worker.
   * @param {string} tenantId - UUID of the tenant
   * @param {string} event - Event name (e.g. 'export.completed')
   * @param {Object} data - Event data payload
   * @returns {Promise<Array<Object>>} Created delivery records
   */
  async emitWebhookEvent(tenantId, event, data) {
    if (!tenantId) {
      logger.warn(`[WebhookDispatcher] Cannot emit ${event} without tenantId`);
      return [];
    }

    try {
      // Find all active endpoints for this tenant
      const endpoints = await WebhookEndpoint.findAll({
        where: { tenant_id: tenantId, is_active: true },
      });

      const matchingEndpoints = endpoints.filter((ep) => {
        let evList = ep.events;
        if (typeof evList === 'string') {
          try { evList = JSON.parse(evList); } catch { evList = []; }
        }
        if (!Array.isArray(evList)) evList = [];
        return evList.includes(event) || evList.includes('*') || evList.includes('all');
      });

      if (matchingEndpoints.length === 0) {
        logger.debug(`[WebhookDispatcher] No active subscribers for ${event} in tenant ${tenantId}`);
        return [];
      }

      const deliveries = [];
      const timestamp = new Date().toISOString();

      for (const endpoint of matchingEndpoints) {
        const eventId = crypto.randomUUID();
        const payload = {
          id: eventId,
          event,
          created_at: timestamp,
          tenant_id: tenantId,
          data,
        };

        const delivery = await WebhookDelivery.create({
          endpoint_id: endpoint.id,
          tenant_webhook_id: endpoint.id,
          tenant_id: tenantId,
          event,
          event_key: event,
          event_id: eventId,
          payload,
          status: 'pending',
          attempts: 0,
        });

        deliveries.push(delivery);

        // Enqueue or run async delivery
        this.enqueueDelivery(delivery.id, endpoint.id).catch((err) => {
          logger.error(`[WebhookDispatcher] Failed to enqueue delivery ${delivery.id}: ${err.message}`);
        });
      }

      return deliveries;
    } catch (err) {
      console.error('EMIT WEBHOOK ERROR 2:', err.message, err.parent?.message || err);
      logger.error(`[WebhookDispatcher] Error emitting webhook event ${event}: ${err.message}`);
      return [];
    }
  }

  /**
   * Enqueues or starts delivery attempt asynchronously.
   */
  async enqueueDelivery(deliveryId, endpointId) {
    // Try BullMQ queue if initialized
    try {
      const { webhookDeliveryQueue } = require('../queue/queues/webhookDelivery.queue');
      if (webhookDeliveryQueue) {
        await webhookDeliveryQueue.add('deliverWebhookEndpoint', { deliveryId, endpointId });
        return;
      }
    } catch {
      // Fallback to async execution
    }

    // Direct background execution if queue is not active
    setImmediate(() => {
      this.executeDeliveryAttempt(deliveryId).catch((err) => {
        logger.warn(`[WebhookDispatcher] Direct delivery attempt failed: ${err.message}`);
      });
    });
  }

  /**
   * Executes a single delivery attempt with SSRF protection, HMAC signing, and backoff handling.
   */
  async executeDeliveryAttempt(deliveryId) {
    const delivery = await WebhookDelivery.findByPk(deliveryId);
    if (!delivery || delivery.status === 'success') {
      return;
    }

    const endpoint = await WebhookEndpoint.findByPk(delivery.endpoint_id);
    if (!endpoint || !endpoint.is_active) {
      await delivery.update({ status: 'failed', last_error: 'Endpoint not found or disabled' });
      return;
    }

    const currentAttempt = (delivery.attempts || 0) + 1;
    const maxAttempts = parseInt(process.env.WEBHOOK_MAX_ATTEMPTS, 10) || 5;
    const timeoutMs = parseInt(process.env.WEBHOOK_TIMEOUT_MS, 10) || 10000;
    const autoDisableFailures = parseInt(process.env.WEBHOOK_DISABLE_AFTER_FAILURES, 10) || 10;

    // 1. SSRF Validation
    const ssrfCheck = await validateWebhookUrl(endpoint.url);
    if (!ssrfCheck.isValid) {
      const errorMsg = `SSRF Check Failed: ${ssrfCheck.error}`;
      logger.warn(`[WebhookDispatcher] Blocked delivery ${deliveryId} to ${endpoint.url}: ${errorMsg}`);
      await delivery.update({
        attempts: currentAttempt,
        status: 'failed',
        last_error: errorMsg,
      });
      return;
    }

    // 2. Prepare Payload & Signature
    const timestamp = new Date().toISOString();
    const payloadString = JSON.stringify(delivery.payload);
    const signature = generateTimestampedSignature(payloadString, endpoint.secret, timestamp);

    const headers = {
      'Content-Type': 'application/json',
      'X-Nanoshipy-Event': delivery.event,
      'X-Nanoshipy-Event-Id': delivery.event_id,
      'X-Nanoshipy-Timestamp': timestamp,
      'X-Nanoshipy-Signature': signature,
      'User-Agent': 'Nanoshipy-Webhook/1.0',
    };

    try {
      const response = await axios.post(endpoint.url, delivery.payload, {
        headers,
        timeout: timeoutMs,
        maxRedirects: 0, // Do not follow redirects (SSRF defense)
        validateStatus: () => true, // inspect raw status
      });

      const responseStatus = response.status;
      const responseBody = typeof response.data === 'string'
        ? response.data.substring(0, 1024)
        : JSON.stringify(response.data || '').substring(0, 1024);

      if (responseStatus >= 200 && responseStatus < 300) {
        // Success
        await delivery.update({
          attempts: currentAttempt,
          status: 'success',
          response_status: responseStatus,
          response_body: responseBody,
          delivered_at: new Date(),
          last_error: null,
          next_retry_at: null,
        });

        // Reset endpoint consecutive failures
        if (endpoint.consecutive_failures > 0) {
          await endpoint.update({ consecutive_failures: 0 });
        }

        logger.info(`[WebhookDispatcher] Webhook ${delivery.event} successfully delivered to ${endpoint.url} (${responseStatus})`);
      } else {
        // HTTP Error status
        await this.handleDeliveryFailure(
          delivery,
          endpoint,
          currentAttempt,
          maxAttempts,
          autoDisableFailures,
          responseStatus,
          `HTTP ${responseStatus}: ${responseBody}`
        );
      }
    } catch (networkError) {
      await this.handleDeliveryFailure(
        delivery,
        endpoint,
        currentAttempt,
        maxAttempts,
        autoDisableFailures,
        null,
        networkError.message
      );
    }
  }

  async handleDeliveryFailure(delivery, endpoint, currentAttempt, maxAttempts, autoDisableFailures, statusCode, errorMsg) {
    const isExhausted = currentAttempt >= maxAttempts;
    const nextDelay = RETRY_DELAYS_MS[currentAttempt - 1] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    const nextRetryAt = isExhausted ? null : new Date(Date.now() + nextDelay);

    await delivery.update({
      attempts: currentAttempt,
      status: isExhausted ? 'failed' : 'pending',
      response_status: statusCode,
      last_error: errorMsg,
      next_retry_at: nextRetryAt,
    });

    const newFailureCount = (endpoint.consecutive_failures || 0) + 1;
    const shouldDisable = newFailureCount >= autoDisableFailures;

    await endpoint.update({
      consecutive_failures: newFailureCount,
      is_active: shouldDisable ? false : endpoint.is_active,
    });

    if (shouldDisable) {
      logger.warn(`[WebhookDispatcher] Auto-disabled endpoint ${endpoint.id} after ${newFailureCount} consecutive failures.`);
    }

    logger.warn(`[WebhookDispatcher] Delivery ${delivery.id} failed (attempt ${currentAttempt}/${maxAttempts}): ${errorMsg}`);
  }

  /**
   * Process pending retries whose next_retry_at <= NOW()
   */
  async processPendingRetries() {
    try {
      const { Op } = require('sequelize');
      const pendingDeliveries = await WebhookDelivery.findAll({
        where: {
          status: 'pending',
          next_retry_at: { [Op.lte]: new Date() },
        },
        limit: 50,
      });

      for (const d of pendingDeliveries) {
        await this.executeDeliveryAttempt(d.id);
      }
    } catch (err) {
      logger.error(`[WebhookDispatcher] Error processing pending retries: ${err.message}`);
    }
  }

  calculateNextRetryDelay(attempt) {
    if (attempt < 1 || attempt > RETRY_DELAYS_MS.length) return null;
    return RETRY_DELAYS_MS[attempt - 1];
  }
}

const dispatcherInstance = new WebhookDispatcherService();
dispatcherInstance.RETRY_DELAYS_MS = RETRY_DELAYS_MS;
dispatcherInstance.WebhookDispatcherService = WebhookDispatcherService;

module.exports = dispatcherInstance;

