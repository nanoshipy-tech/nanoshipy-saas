'use strict';

const { NotificationPreference } = require('../models');
const { BadRequestError } = require('../utils/errors');

const KNOWN_EVENTS = [
  'order.created',
  'order.status_changed',
  'shipment.created',
  'shipment.cancelled',
  'tracking.status_changed',
  'ndr.created',
  'ndr.action_taken',
  'rto.initiated',
  'wallet.low_balance',
];

const ALLOWED_CHANNELS = ['email', 'sms', 'whatsapp', 'inapp'];

/**
 * Get notification preferences merged with known system catalogue defaults.
 */
async function getPreferences(tenantId, userId = null) {
  const existing = await NotificationPreference.findAll({
    where: { tenant_id: tenantId, user_id: userId },
  });

  const preferencesMap = {};
  existing.forEach(p => {
    preferencesMap[`${p.event_key}_${p.channel}`] = p.is_enabled;
  });

  const result = [];
  for (const eventKey of KNOWN_EVENTS) {
    for (const channel of ALLOWED_CHANNELS) {
      const key = `${eventKey}_${channel}`;
      const isEnabled = preferencesMap[key] !== undefined ? preferencesMap[key] : true;
      result.push({
        event_key: eventKey,
        channel,
        is_enabled: isEnabled,
        // In-app notifications are locked and cannot be disabled
        is_locked: channel === 'inapp',
      });
    }
  }

  return result;
}

/**
 * Save notification preference configurations.
 */
async function updatePreferences(tenantId, userId = null, preferences = []) {
  for (const pref of preferences) {
    const { event_key, channel, is_enabled } = pref;

    if (!KNOWN_EVENTS.includes(event_key)) {
      throw new BadRequestError(`Unknown event key: "${event_key}"`, 'UNKNOWN_EVENT_KEY');
    }

    if (!ALLOWED_CHANNELS.includes(channel)) {
      throw new BadRequestError(`Unsupported channel: "${channel}"`, 'UNSUPPORTED_CHANNEL');
    }

    // In-app notifications cannot be customized/disabled
    if (channel === 'inapp') {
      continue;
    }

    // Upsert preference
    await NotificationPreference.upsert({
      tenant_id: tenantId,
      user_id: userId,
      event_key,
      channel,
      is_enabled,
    });
  }

  return { success: true };
}

module.exports = {
  getPreferences,
  updatePreferences,
  KNOWN_EVENTS,
};
