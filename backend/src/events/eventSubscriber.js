'use strict';

const eventBus = require('./eventBus');
const { Order, Shipment, InAppNotification, CourierProvider } = require('../models');
const logger = require('../utils/logger');

/**
 * Initializes global event bus listeners for automated order & shipment processing.
 */
function initEventSubscribers() {
  logger.info('[EventSubscriber] Initializing automated order & tracking event subscribers...');

  // 1. Listen for order.created
  eventBus.on('order.created', async (order) => {
    try {
      logger.info(`[EventSubscriber] Order created: ${order.order_reference} (Tenant: ${order.tenant_id})`);
      
      // Auto-shipment hook if requested or sandbox enabled
      if (order.auto_ship || order.sandbox) {
        const shipmentService = require('../services/shipment.service');
        const shipwayProvider = await CourierProvider.findOne({ where: { provider_key: 'shipway' } });
        
        if (shipwayProvider) {
          logger.info(`[EventSubscriber] Auto-creating Shipway shipment for order ${order.order_reference}...`);
          await shipmentService.createShipment({
            order_id: order.id,
            courier_provider_id: shipwayProvider.id,
            service_type: 'express',
            quoted_rate: 75.00
          }, order.tenant_id, order.created_by || 'system').catch((e) => {
            logger.warn(`[EventSubscriber] Auto-shipment skip: ${e.message}`);
          });
        }
      }
    } catch (err) {
      logger.error(`[EventSubscriber] Error handling order.created for ${order.order_reference}:`, err.message);
    }
  });

  // 2. Listen for tracking.status_changed
  eventBus.on('tracking.status_changed', async (data) => {
    try {
      const { tenant_id, awb_number, tracking_status, location, remarks } = data;
      logger.info(`[EventSubscriber] Tracking status changed for AWB ${awb_number}: ${tracking_status}`);

      const shipment = await Shipment.findOne({ where: { awb_number } });
      if (!shipment) return;

      const order = await Order.findByPk(shipment.order_id);
      if (!order) return;

      // Update Order status based on shipment tracking status
      let newOrderStatus = order.status;
      let newNdrStatus = order.ndr_status;

      if (['picked_up', 'in_transit'].includes(tracking_status)) {
        newOrderStatus = 'in_transit';
      } else if (tracking_status === 'out_for_delivery') {
        newOrderStatus = 'out_for_delivery';
      } else if (tracking_status === 'delivered') {
        newOrderStatus = 'delivered';
      } else if (['ndr_initiated', 'delivery_failed', 'action_submitted'].includes(tracking_status)) {
        newOrderStatus = 'ndr';
        newNdrStatus = 'action_required';
      } else if (['rto_initiated', 'rto_in_transit', 'rto_delivered'].includes(tracking_status)) {
        newOrderStatus = 'rto';
      }

      if (newOrderStatus !== order.status || newNdrStatus !== order.ndr_status) {
        await order.update({ status: newOrderStatus, ndr_status: newNdrStatus });
      }

      // Create In-App Notifications for Merchant & Admin
      const notifyTitle = `Shipment ${awb_number} status: ${tracking_status.toUpperCase()}`;
      const notifyBody = `Order #${order.order_reference} is now ${tracking_status.replace(/_/g, ' ')}. Location: ${location || 'Hub'}.`;

      if (InAppNotification) {
        await InAppNotification.create({
          tenant_id: tenant_id,
          title: notifyTitle,
          message: notifyBody,
          type: tracking_status === 'delivered' ? 'success' : tracking_status.includes('ndr') ? 'warning' : 'info',
          is_read: false,
          link: `/shipments?search=${awb_number}`
        }).catch(() => {});
      }

    } catch (err) {
      logger.error(`[EventSubscriber] Error handling tracking.status_changed:`, err.message);
    }
  });
}

module.exports = { initEventSubscribers };
