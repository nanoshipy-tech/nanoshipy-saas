'use strict';

const { NotificationTemplate, NotificationPreference, NotificationLog, User, Tenant, sequelize } = require('../models');
const { notificationDispatchQueue } = require('../queue/queues/notificationDispatch.queue');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

// Allowlist milestones for noisy intermediate tracking updates (SMS/WhatsApp)
const NOTIFIABLE_TRACKING_STATUSES = ['picked_up', 'out_for_delivery', 'delivered', 'rto_initiated', 'ndr'];

class UnknownEventKeyError extends Error {
  constructor(message) {
    super(message || 'Unknown notification event key');
    this.name = 'UnknownEventKeyError';
    this.statusCode = 422;
  }
}

/**
 * Dispatches event notifications based on template variables and channel settings.
 */
async function dispatch(eventKey, payload) {
  logger.info(`[NotificationService] Dispatching event: ${eventKey}`);

  // 1. Resolve Tenant ID
  const tenantId = payload.tenant_id || payload.tenantId ||
                   payload.order?.tenant_id || payload.shipment?.tenant_id ||
                   payload.ndr?.tenant_id || payload.wallet?.tenant_id;

  if (!tenantId) {
    logger.warn(`[NotificationService] Skipped dispatch for ${eventKey} due to missing tenantId in payload.`);
    return;
  }

  // 2. Lookup active templates for event
  const templates = await NotificationTemplate.findAll({
    where: { event_key: eventKey, is_active: true },
  });

  if (templates.length === 0) {
    logger.warn(`[NotificationService] No active templates found for event: ${eventKey}`);
    return;
  }

  // Fetch tenant details for email fallback
  const tenant = await Tenant.findByPk(tenantId);
  const owner = await User.findOne({
    where: { tenant_id: tenantId },
    order: [['created_at', 'ASC']],
  });

  for (const template of templates) {
    const channel = template.channel;

    // 3. Evaluate intermediate status filters for noisy alerts (SMS/WhatsApp)
    if (eventKey === 'tracking.status_changed' && (channel === 'sms' || channel === 'whatsapp')) {
      const trackingStatus = payload.tracking_status || payload.status;
      if (!NOTIFIABLE_TRACKING_STATUSES.includes(trackingStatus)) {
        logger.info(`[NotificationService] Noisy tracking status "${trackingStatus}" skipped for SMS/WhatsApp.`);
        continue;
      }
    }

    // 4. Resolve Preferences (In-app is always enabled and cannot be turned off)
    if (channel !== 'inapp') {
      const isEnabled = await resolvePreference(tenantId, payload.user_id || owner?.id, eventKey, channel);
      if (!isEnabled) {
        logger.info(`[NotificationService] Event ${eventKey} for channel ${channel} is disabled via preferences.`);
        continue;
      }
    }

    // 5. Resolve Recipient
    let recipient = null;
    if (channel === 'email') {
      recipient = payload.email || payload.customer_email || payload.order?.customer_email || owner?.email;
    } else if (channel === 'sms' || channel === 'whatsapp') {
      recipient = payload.phone || payload.customer_phone || payload.order?.customer_phone || owner?.phone;
    } else if (channel === 'inapp') {
      recipient = payload.user_id || payload.userId || owner?.id;
    }

    if (!recipient) {
      logger.warn(`[NotificationService] Could not resolve recipient for ${eventKey} (${channel}). Skipped.`);
      continue;
    }

    // 6. Render templates
    const subject = renderString(template.subject || '', payload);
    const body = renderString(template.body_template || '', payload);

    // 7. Write notification log entry in queued state
    const log = await NotificationLog.create({
      tenant_id: tenantId,
      event_key: eventKey,
      channel,
      recipient,
      status: 'queued',
    });

    // 8. Enqueue background dispatch job (BullMQ)
    await notificationDispatchQueue.add('dispatch-channel', {
      logId: log.id,
      tenantId,
      recipient,
      subject,
      body,
      channel,
      metadata: {
        tenant_id: tenantId,
        user_id: recipient,
        event_key: eventKey,
        link_url: payload.link_url || null,
        meta_template_name: template.meta_template_name,
      },
    });

    logger.info(`[NotificationService] Enqueued ${channel} dispatch for log ID: ${log.id}`);
  }
}

/**
 * Resolves priority chain: User Custom -> Tenant Default -> System default (Enabled).
 */
async function resolvePreference(tenantId, userId, eventKey, channel) {
  if (userId) {
    const userPref = await NotificationPreference.findOne({
      where: { tenant_id: tenantId, user_id: userId, event_key: eventKey, channel },
    });
    if (userPref !== null) return userPref.is_enabled;
  }

  const tenantPref = await NotificationPreference.findOne({
    where: { tenant_id: tenantId, user_id: null, event_key: eventKey, channel },
  });
  if (tenantPref !== null) return tenantPref.is_enabled;

  return true; // Default to enabled
}

/**
 * Performs simple placeholder interpolation: {{ variable }}
 */
function renderString(str, variables) {
  if (!str) return '';
  return str.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (match, key) => {
    // Support nested paths (e.g. order.order_reference)
    const parts = key.split('.');
    let value = variables;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }
    return value !== undefined && value !== null ? String(value) : '';
  });
}

module.exports = {
  dispatch,
  resolvePreference,
  renderString,
  UnknownEventKeyError,
};
