'use strict';

const eventBus = require('./eventBus');
const notificationService = require('../services/notification.service');
const outboundWebhookService = require('../services/outboundWebhook.service');
const logger = require('../utils/logger');

// Centralized Event to Notification Hook Mapping Registry
const subscriptionMap = {
  'order.created': (payload) => notificationService.dispatch('order.created', payload),
  'order.status_changed': (payload) => notificationService.dispatch('order.status_changed', payload),
  'shipment.created': (payload) => notificationService.dispatch('shipment.created', payload),
  'shipment.cancelled': (payload) => notificationService.dispatch('shipment.cancelled', payload),
  'tracking.status_changed': (payload) => notificationService.dispatch('tracking.status_changed', payload),
  'ndr.created': (payload) => notificationService.dispatch('ndr.created', payload),
  'ndr.action_taken': (payload) => notificationService.dispatch('ndr.action_taken', payload),
  'rto.initiated': (payload) => notificationService.dispatch('rto.initiated', payload),
  'wallet.low_balance': (payload) => notificationService.dispatch('wallet.low_balance', payload),
  'ticket.created': (payload) => notificationService.dispatch('ticket.created', payload),
  'ticket.replied': (payload) => notificationService.dispatch('ticket.replied', payload),
  'ticket.resolved': (payload) => notificationService.dispatch('ticket.resolved', payload),
};

function initializeSubscriptions() {
  for (const [eventKey, handler] of Object.entries(subscriptionMap)) {
    eventBus.on(eventKey, async (payload) => {
      try {
        logger.info(`[EventSubscriptions] Triggered notification and webhook dispatch for key: "${eventKey}"`);
        
        // 1. Dispatch internal notifications
        await handler(payload);
        
        // 2. Dispatch outbound tenant webhooks
        // Payload typically contains tenant_id. If not, it should be extracted/passed appropriately.
        // We assume payload.tenant_id is present for tenant-specific events.
        if (payload && payload.tenant_id) {
          await outboundWebhookService.dispatchToTenantWebhooks(eventKey, payload.tenant_id, payload);
        }
      } catch (err) {
        logger.error(`[EventSubscriptions] Handler failed for "${eventKey}": ${err.message}`);
      }
    });
  }

  // SOW G5 Auto-ticket creation on NDR escalation
  eventBus.on('ndr.escalated', async (payload) => {
    try {
      logger.info(`[EventSubscriptions] NDR escalated event received, creating support ticket.`);
      const supportTicketService = require('../services/supportTicket.service');
      await supportTicketService.createFromNdrEscalation(payload);
    } catch (err) {
      logger.error(`[EventSubscriptions] Failed to create ticket from NDR escalation: ${err.message}`);
    }
  });

  logger.info('[EventSubscriptions] Successfully registered all central notification hooks.');
}

module.exports = {
  initializeSubscriptions,
  subscriptionMap,
};
