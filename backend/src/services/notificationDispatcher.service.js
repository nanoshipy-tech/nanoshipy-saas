'use strict';

const logger = require('../utils/logger');
const config = require('../config/env');
const { NotificationLog, Order } = require('../models');

class NotificationDispatcherService {
  /**
   * Unified multi-channel notification dispatcher with automated fallback:
   * 1. WhatsApp -> 2. SMS -> 3. Email
   */
  async dispatch({ tenantId, recipientPhone, recipientEmail, event, data = {} }) {
    let sentVia = null;
    let errorDetails = null;

    // 1. Attempt WhatsApp only if customer has not opted out (DPDP Act compliance)
    const isWhatsappAllowed = data.whatsapp_opted_in !== false;
    if (recipientPhone && isWhatsappAllowed) {
      try {
        const whatsappAdapter = require('./whatsappAdapter.service');
        if (whatsappAdapter && whatsappAdapter.sendTemplateMessage) {
          await whatsappAdapter.sendTemplateMessage({
            to: recipientPhone,
            templateName: data.templateName || 'shipping_update',
            variables: data.variables || [data.customerName || 'Customer', data.trackingNumber || '', data.trackingUrl || ''],
          });
          sentVia = 'whatsapp';
          logger.info(`[NotificationDispatcher] Sent notification via WhatsApp to ${recipientPhone}`);
        }
      } catch (waErr) {
        logger.warn(`[NotificationDispatcher] WhatsApp failed: ${waErr.message}. Falling back to SMS.`);
        errorDetails = waErr.message;
      }
    } else if (recipientPhone && !isWhatsappAllowed) {
      logger.info(`[NotificationDispatcher] WhatsApp skipped for ${recipientPhone}: customer opted out (whatsapp_opted_in = false). Proceeding to SMS/Email fallback.`);
    }

    // 2. Fallback to SMS if WhatsApp failed or wasn't sent
    if (!sentVia && recipientPhone) {
      try {
        const smsService = require('./sms.service');
        if (smsService && smsService.sendSMS) {
          const smsText = data.smsText || `Shipping Update: Your order ${data.orderReference || ''} has been dispatched. Track here: ${data.trackingUrl || ''}`;
          await smsService.sendSMS(recipientPhone, smsText);
          sentVia = 'sms';
          logger.info(`[NotificationDispatcher] Sent notification via SMS fallback to ${recipientPhone}`);
        }
      } catch (smsErr) {
        logger.warn(`[NotificationDispatcher] SMS failed: ${smsErr.message}. Falling back to Email.`);
        errorDetails = (errorDetails ? errorDetails + ' | ' : '') + smsErr.message;
      }
    }

    // 3. Fallback to Email if WhatsApp and SMS failed or phone was missing
    if (!sentVia && recipientEmail) {
      try {
        const emailService = require('./email.service');
        if (emailService && emailService.sendEmail) {
          await emailService.sendEmail({
            to: recipientEmail,
            subject: data.subject || `Order Update: ${data.orderReference || 'Dispatched'}`,
            text: `Hello ${data.customerName || 'Customer'},\n\nYour order has been dispatched via ${data.courierName || 'Courier'} with tracking number ${data.trackingNumber || ''}.\n\nTrack your shipment live: ${data.trackingUrl || ''}\n\nThank you for shopping with us!`,
          });
          sentVia = 'email';
          logger.info(`[NotificationDispatcher] Sent notification via Email fallback to ${recipientEmail}`);
        }
      } catch (emailErr) {
        logger.error(`[NotificationDispatcher] All notification channels failed: ${emailErr.message}`);
        errorDetails = (errorDetails ? errorDetails + ' | ' : '') + emailErr.message;
      }
    }

    // Record delivery log
    if (NotificationLog && tenantId) {
      try {
        await NotificationLog.create({
          tenant_id: tenantId,
          channel: sentVia || 'failed',
          recipient: recipientPhone || recipientEmail || 'unknown',
          event_type: event,
          status: sentVia ? 'delivered' : 'failed',
          metadata: { data, error: errorDetails },
        });
      } catch (logErr) {
        logger.warn(`[NotificationDispatcher] Failed to write NotificationLog: ${logErr.message}`);
      }
    }

    return { success: Boolean(sentVia), channel: sentVia, error: errorDetails };
  }

  /**
   * Helper specifically for customer tracking link on shipment dispatch
   */
  async sendShipmentDispatchedNotification(shipment) {
    try {
      const order = shipment.order || (shipment.order_id ? await Order.findByPk(shipment.order_id) : null);
      const awb = shipment.awb_number || shipment.id;

      // Resolve clean courier name (e.g. Blue Dart • Express, Delhivery • Express, ST Courier)
      let courierName = null;
      try {
        const receiptPdfService = require('./receiptPdf.service');
        courierName = receiptPdfService.getCleanCarrierName(shipment, order);
      } catch (_) {}

      if (!courierName || courierName.toLowerCase().includes('shipway')) {
        courierName = shipment.courier_name || shipment.courier_partner || 'Nanoshipy Express';
      }

      const trackingBaseUrl = config.frontendUrl || 'https://app.nanoshipy.com';
      const trackingUrl = `${trackingBaseUrl}/track/${awb}`;
      const orderRef = order?.order_reference || shipment.order_id;

      // Handle walk-in customer booking: notify the sender (booking customer) as well as consignee
      if (order?.is_walkin) {
        const senderPhone = order.sender_phone;
        const senderName = order.sender_name || 'Valued Customer';
        let senderResult = null;

        if (senderPhone) {
          senderResult = await this.dispatch({
            tenantId: shipment.tenant_id,
            recipientPhone: senderPhone,
            recipientEmail: null,
            event: 'walkin_shipment_booked',
            data: {
              customerName: senderName,
              orderReference: orderRef,
              trackingNumber: awb,
              courierName,
              trackingUrl,
              whatsapp_opted_in: true,
              templateName: 'shipment_dispatched_alert',
              smsText: `Hi ${senderName}, your parcel #${orderRef} has been booked via ${courierName}. Live tracking: ${trackingUrl} - Nanoshipy`,
              subject: `Booking Confirmed: #${orderRef} (AWB: ${awb})`,
            },
          });
        }

        // Also notify receiver/consignee if different from sender
        const consigneePhone = order.customer_phone;
        if (consigneePhone && consigneePhone !== senderPhone) {
          await this.dispatch({
            tenantId: shipment.tenant_id,
            recipientPhone: consigneePhone,
            recipientEmail: order.customer_email || null,
            event: 'shipment_dispatched',
            data: {
              customerName: order.customer_name || 'Valued Customer',
              orderReference: orderRef,
              trackingNumber: awb,
              courierName,
              trackingUrl,
              whatsapp_opted_in: order.whatsapp_opted_in !== false,
              templateName: 'shipment_dispatched_alert',
              smsText: `Hi ${order.customer_name || 'Customer'}, a parcel #${orderRef} has been dispatched to you via ${courierName}. Live tracking: ${trackingUrl} - Nanoshipy`,
              subject: `Parcel on the way: #${orderRef} (AWB: ${awb})`,
            },
          });
        }

        return senderResult || { success: true };
      }

      // Standard e-commerce order notification
      const recipientPhone = order?.customer_phone || (shipment.shipping_address && shipment.shipping_address.phone);
      const recipientEmail = order?.customer_email || (shipment.shipping_address && shipment.shipping_address.email);
      const customerName = order?.customer_name || 'Valued Customer';

      return await this.dispatch({
        tenantId: shipment.tenant_id,
        recipientPhone,
        recipientEmail,
        event: 'shipment_dispatched',
        data: {
          customerName,
          orderReference: orderRef,
          trackingNumber: awb,
          courierName,
          trackingUrl,
          whatsapp_opted_in: order ? order.whatsapp_opted_in !== false : true,
          templateName: 'shipment_dispatched_alert',
          smsText: `Hi ${customerName}, your order #${orderRef} has been shipped via ${courierName}. Live tracking: ${trackingUrl} - Nanoshipy`,
          subject: `Your order #${orderRef} has been shipped! (AWB: ${awb})`,
        },
      });
    } catch (err) {
      logger.error(`[NotificationDispatcher] Error sending shipment dispatched alert: ${err.message}`);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new NotificationDispatcherService();
