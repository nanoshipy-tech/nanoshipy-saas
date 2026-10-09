'use strict';

const crypto = require('crypto');
const logger = require('../../utils/logger');
const MyDreamsSmsLog = require('../../models/myDreamsSmsLog.model');
const MyDreamsSmsTemplate = require('../../models/myDreamsSmsTemplate.model');
const myDreamsSms = require('./myDreamsSms.service');

/**
 * Generate a cryptographically secure, non-guessable random token for order tracking
 */
function generateTrackingToken() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Check if an SMS was already sent for this order and status event to prevent duplicates
 */
async function hasAlreadySent(orderId, statusEvent) {
  if (!orderId || !statusEvent) return false;
  const existing = await MyDreamsSmsLog.findOne({
    where: {
      order_id: String(orderId),
      status_event: statusEvent,
      status: ['sent', 'simulated'],
    },
  });
  return !!existing;
}

/**
 * Interpolate template placeholders {#var#}
 */
function fillTemplateVars(templateText, variableOrder, valuesMap) {
  if (!templateText) return null;
  const vars = Array.isArray(variableOrder) ? variableOrder : Object.keys(valuesMap);
  let text = templateText;
  vars.forEach(k => {
    const val = valuesMap[k] || '';
    text = text.replace('{#var#}', val);
  });
  return text;
}

/**
 * Handle Order Confirmation SMS
 */
async function sendOrderConfirmationNotification(order) {
  try {
    if (!order) return { success: false, error: 'NO_ORDER_DATA' };

    const orderId = order.id || order.order_id;
    const recipientPhone = order.customer_phone || order.phone || order.shipping_address?.phone;
    if (!recipientPhone) return { success: false, error: 'NO_PHONE_NUMBER' };

    // Prevent duplicate send
    const alreadySent = await hasAlreadySent(orderId, 'order_confirmed');
    if (alreadySent) {
      logger.info(`[MyDreamsNotification] Order confirmation SMS already sent for order ${orderId}. Skipping.`);
      return { success: true, skipped: true, reason: 'ALREADY_SENT' };
    }

    const template = await MyDreamsSmsTemplate.findOne({
      where: { template_key: 'order_confirmed', is_active: true },
    });

    if (!template || !template.template_text || !template.template_text.trim()) {
      logger.info(`[MyDreamsNotification] Template 'order_confirmed' is empty or missing. Skipping.`);
      await MyDreamsSmsLog.create({
        phone_masked: myDreamsSms.maskPhoneNumber(recipientPhone),
        template_key: 'order_confirmed',
        order_id: String(orderId),
        status_event: 'order_confirmed',
        status: 'skipped',
        error_message: 'template missing',
        sent_at: new Date(),
      });
      return { success: true, skipped: true, reason: 'TEMPLATE_MISSING' };
    }

    const customerName = order.customer_name || 'Customer';
    const orderNumber = order.order_number || order.order_reference || String(orderId).slice(0, 8);

    const message = fillTemplateVars(template.template_text, template.variable_order, {
      customer_name: customerName,
      order_number: orderNumber,
    });

    return await myDreamsSms.sendSMS({
      to: recipientPhone,
      message,
      templateKey: 'order_confirmed',
      orderId,
      statusEvent: 'order_confirmed',
    });
  } catch (err) {
    logger.error(`[MyDreamsNotification] Error sending order confirmation SMS: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Handle Out For Delivery SMS
 */
async function sendOutForDeliveryNotification(shipment, order) {
  try {
    const orderId = order?.id || shipment?.order_id;
    const recipientPhone = order?.customer_phone || shipment?.shipping_address?.phone || shipment?.recipient_phone;
    if (!recipientPhone) return { success: false, error: 'NO_PHONE_NUMBER' };

    // Prevent duplicate send
    const alreadySent = await hasAlreadySent(orderId, 'out_for_delivery');
    if (alreadySent) {
      logger.info(`[MyDreamsNotification] Out-for-delivery SMS already sent for order ${orderId}. Skipping.`);
      return { success: true, skipped: true, reason: 'ALREADY_SENT' };
    }

    const template = await MyDreamsSmsTemplate.findOne({
      where: { template_key: 'out_for_delivery', is_active: true },
    });

    if (!template || !template.template_text || !template.template_text.trim()) {
      logger.info(`[MyDreamsNotification] Template 'out_for_delivery' is empty or missing. Skipping.`);
      await MyDreamsSmsLog.create({
        phone_masked: myDreamsSms.maskPhoneNumber(recipientPhone),
        template_key: 'out_for_delivery',
        order_id: orderId ? String(orderId) : null,
        status_event: 'out_for_delivery',
        status: 'skipped',
        error_message: 'template missing',
        sent_at: new Date(),
      });
      return { success: true, skipped: true, reason: 'TEMPLATE_MISSING' };
    }

    const customerName = order?.customer_name || shipment?.recipient_name || 'Customer';
    const orderNumber = order?.order_number || order?.order_reference || shipment?.awb_number || 'Order';

    const message = fillTemplateVars(template.template_text, template.variable_order, {
      customer_name: customerName,
      order_number: orderNumber,
    });

    return await myDreamsSms.sendSMS({
      to: recipientPhone,
      message,
      templateKey: 'out_for_delivery',
      orderId,
      statusEvent: 'out_for_delivery',
    });
  } catch (err) {
    logger.error(`[MyDreamsNotification] Error sending out for delivery SMS: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Handle Live Tracking Link SMS
 */
async function sendTrackingLinkNotification(shipment, order) {
  try {
    const orderId = order?.id || shipment?.order_id;
    const recipientPhone = order?.customer_phone || shipment?.shipping_address?.phone || shipment?.recipient_phone;
    if (!recipientPhone) return { success: false, error: 'NO_PHONE_NUMBER' };

    // Prevent duplicate send
    const alreadySent = await hasAlreadySent(orderId, 'tracking');
    if (alreadySent) {
      logger.info(`[MyDreamsNotification] Tracking SMS already sent for order ${orderId}. Skipping.`);
      return { success: true, skipped: true, reason: 'ALREADY_SENT' };
    }

    const template = await MyDreamsSmsTemplate.findOne({
      where: { template_key: 'tracking', is_active: true },
    });

    if (!template || !template.template_text || !template.template_text.trim()) {
      logger.info(`[MyDreamsNotification] Template 'tracking' is empty or missing. Skipping.`);
      await MyDreamsSmsLog.create({
        phone_masked: myDreamsSms.maskPhoneNumber(recipientPhone),
        template_key: 'tracking',
        order_id: orderId ? String(orderId) : null,
        status_event: 'tracking',
        status: 'skipped',
        error_message: 'template missing',
        sent_at: new Date(),
      });
      return { success: true, skipped: true, reason: 'TEMPLATE_MISSING' };
    }

    // Determine tracking URL: courier tracking URL if present, otherwise public tracking page with AWB or token
    const courierTrackingUrl = shipment?.tracking_url || shipment?.courier_tracking_url;
    let finalTrackingUrl = courierTrackingUrl;
    if (!finalTrackingUrl) {
      const trackingIdentifier = shipment?.awb_number || generateTrackingToken();
      finalTrackingUrl = `https://app.nanoshipy.com/track/${trackingIdentifier}`;
    }

    const customerName = order?.customer_name || shipment?.recipient_name || 'Customer';
    const orderNumber = order?.order_number || order?.order_reference || shipment?.awb_number || 'Order';

    const message = fillTemplateVars(template.template_text, template.variable_order, {
      customer_name: customerName,
      order_number: orderNumber,
      tracking_url: finalTrackingUrl,
    });

    return await myDreamsSms.sendSMS({
      to: recipientPhone,
      message,
      templateKey: 'tracking',
      orderId,
      statusEvent: 'tracking',
    });
  } catch (err) {
    logger.error(`[MyDreamsNotification] Error sending tracking link SMS: ${err.message}`);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendOrderConfirmationNotification,
  sendOutForDeliveryNotification,
  sendTrackingLinkNotification,
  generateTrackingToken,
};
