'use strict';

const { InAppNotification } = require('../../models');
const logger = require('../../utils/logger');
const NotificationChannel = require('../base/NotificationChannel.interface');

const EVENT_TITLES = {
  'ticket.created': 'Support Ticket Created',
  'ticket.replied': 'Support Ticket Reply',
  'ticket.resolved': 'Support Ticket Resolved',
  'ticket.sla_breach_warning': 'SLA Breach Warning',
  'order.created': 'New Order Received',
  'order.status_changed': 'Order Status Updated',
  'shipment.created': 'Shipment Booked',
  'shipment.cancelled': 'Shipment Cancelled',
  'tracking.status_changed': 'Tracking Update',
  'ndr.created': 'NDR Action Required',
  'ndr.action_taken': 'NDR Action Taken',
  'rto.initiated': 'Return Initiated (RTO)',
  'wallet.low_balance': 'Low Wallet Balance',
};

class InAppChannel extends NotificationChannel {
  async send({ recipient, subject, body, metadata }) {
    try {
      const tenantId = metadata?.tenant_id;
      const eventKey = metadata?.event_key;
      const fallbackTitle = (eventKey && EVENT_TITLES[eventKey]) || 'System Notification';
      const title = (subject && subject.trim().length > 0) ? subject : fallbackTitle;
      const linkUrl = metadata?.link_url || null;

      if (!tenantId || !recipient) {
        throw new Error('InApp notifications require both tenant_id and user_id (recipient).');
      }

      const notif = await InAppNotification.create({
        tenant_id: tenantId,
        user_id: recipient,
        title,
        body,
        link_url: linkUrl,
        is_read: false,
      });

      logger.info(`[InAppChannel] Created in-app notification for user ${recipient} inside tenant ${tenantId}`);
      return {
        success: true,
        providerMessageId: notif.id,
        error: null,
      };
    } catch (err) {
      logger.error(`[InAppChannel] Failed to write notification: ${err.message}`);
      return {
        success: false,
        providerMessageId: null,
        error: err.message,
      };
    }
  }
}

module.exports = InAppChannel;
