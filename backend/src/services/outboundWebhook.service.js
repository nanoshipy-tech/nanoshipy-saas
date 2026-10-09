'use strict';

const crypto = require('crypto');
const tenantWebhookRepository = require('../repositories/tenantWebhook.repository');
const webhookDeliveryRepository = require('../repositories/webhookDelivery.repository');
// We enqueue deliveries via BullMQ
const { webhookDeliveryQueue } = require('../queue/queues/webhookDelivery.queue');

class OutboundWebhookService {
  /**
   * Generates a new webhook secret prefixing with whsec_
   */
  generateSecret() {
    const randomHex = crypto.randomBytes(32).toString('hex');
    return `whsec_${randomHex}`;
  }

  async registerWebhook(tenantId, userId, data) {
    // Validate target_url to avoid SSRF in a real production environment
    // For now we check if it is valid HTTPS URL
    if (data.target_url) {
      const url = new URL(data.target_url);
      if (url.protocol !== 'https:') {
        if (process.env.NODE_ENV === 'production' || (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')) {
          throw new Error('Only HTTPS endpoints are allowed for outbound webhooks');
        }
      }
    }

    const secret = this.generateSecret();
    const webhook = await tenantWebhookRepository.create({
      tenant_id: tenantId,
      target_url: data.target_url,
      subscribed_events: data.subscribed_events || [],
      secret,
      created_by: userId,
    });

    return {
      webhook,
      secret,
    };
  }

  async updateWebhook(id, tenantId, data) {
    return tenantWebhookRepository.update(id, tenantId, {
      target_url: data.target_url,
      subscribed_events: data.subscribed_events,
      is_active: data.is_active,
    });
  }

  async deleteWebhook(id, tenantId) {
    return tenantWebhookRepository.delete(id, tenantId);
  }

  async listWebhooks(tenantId, options) {
    return tenantWebhookRepository.listByTenant(tenantId, options);
  }

  /**
   * Called by the event bus to dispatch an event to all matching tenant webhooks.
   * Note: This does not dispatch to a specific tenant webhook by ID, it finds all webhooks
   * across all tenants that are active and subscribed to this event.
   * In a real multi-tenant system, `tenantId` is passed to the event, so we can filter by it!
   */
  async dispatchToTenantWebhooks(eventKey, tenantId, payloadData) {
    if (!tenantId) return; // Cannot dispatch tenant webhook if no tenant is associated

    const activeWebhooks = await tenantWebhookRepository.listByTenant(tenantId, { where: { is_active: true } });
    
    for (const webhook of activeWebhooks.rows) {
      if (webhook.subscribed_events.includes(eventKey)) {
        await this.enqueueDelivery(webhook, eventKey, payloadData);
      }
    }
  }

  async enqueueDelivery(webhook, eventKey, payloadData) {
    const payload = {
      event: eventKey,
      tenant_id: webhook.tenant_id,
      data: payloadData,
      timestamp: new Date().toISOString(),
    };

    // 1. Create a delivery record with status pending
    const delivery = await webhookDeliveryRepository.create({
      tenant_webhook_id: webhook.id,
      event_key: eventKey,
      payload,
      status: 'pending',
    });

    // 2. Enqueue the job for the worker
    if (webhookDeliveryQueue) {
      await webhookDeliveryQueue.add('deliverWebhook', {
        deliveryId: delivery.id,
        webhookId: webhook.id,
        targetUrl: webhook.target_url,
        secret: webhook.secret,
        payload,
      }, {
        attempts: parseInt(process.env.WEBHOOK_MAX_RETRY_ATTEMPTS || 4),
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      });
    } else {
      const logger = require('../utils/logger');
      logger.warn('[OutboundWebhookService] webhookDeliveryQueue is not initialized. Cannot enqueue delivery.');
    }
    
    return delivery;
  }

  async sendTestPing(id, tenantId) {
    const webhook = await tenantWebhookRepository.findById(id, tenantId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      message: 'This is a test delivery',
    };

    return this.enqueueDelivery(webhook, 'webhook.test', testPayload);
  }

  async getDeliveries(webhookId, options) {
    return webhookDeliveryRepository.listByWebhookId(webhookId, options);
  }
}

module.exports = new OutboundWebhookService();
