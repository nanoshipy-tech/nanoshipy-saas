'use strict';

const logger = require('../../utils/logger');

// Explicit mapping table from Delhivery's status strings to platform fixed statuses
const statusMapping = {
  'manifested': 'awb_generated',
  'pending': 'created',
  'dispatched': 'in_transit',
  'in_transit': 'in_transit',
  'inbound': 'in_transit',
  'out_for_delivery': 'out_for_delivery',
  'ofd': 'out_for_delivery',
  'delivered': 'delivered',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'returned': 'failed',
  'rto': 'failed',
  'failed': 'failed',
};

/**
 * Normalizes a raw Delhivery status string to standard platform shipment status enum.
 *
 * @param {string} rawStatus
 * @returns {string}
 */
const mapStatus = (rawStatus) => {
  if (!rawStatus) return 'in_transit';
  const normalized = rawStatus.toLowerCase().trim().replace(/\s+/g, '_');
  const mapped = statusMapping[normalized];
  if (!mapped) {
    logger.warn(`DelhiveryResponseMapper: Encountered unmapped status "${rawStatus}". Defaulting to "in_transit".`);
    return 'in_transit';
  }
  return mapped;
};

module.exports = {
  mapStatus,
  statusMapping,
};
