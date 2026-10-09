'use strict';

const logger = require('../../utils/logger');

const statusMapping = {
  'order_placed': 'awb_generated',
  'allotted': 'awb_generated',
  'assigned': 'awb_generated',
  'pickup_complete': 'in_transit',
  'picked_up': 'in_transit',
  'arrived': 'in_transit',
  'in_transit': 'in_transit',
  'reached_hub': 'in_transit',
  'reached_destination': 'in_transit',
  'out_for_delivery': 'out_for_delivery',
  'delivered': 'delivered',
  'delivery_failed': 'undelivered',
  'undelivered': 'undelivered',
  'attempted': 'undelivered',
  'rto_initiated': 'rto_initiated',
  'rto': 'rto_initiated',
  'rto_in_transit': 'rto_in_transit',
  'rto_delivered': 'rto_delivered',
  'returned': 'rto_delivered',
  'cancelled': 'cancelled',
};

const mapStatus = (rawStatus) => {
  if (!rawStatus) return 'in_transit';
  const normalized = String(rawStatus).toLowerCase().trim().replace(/[\s-]+/g, '_');
  const mapped = statusMapping[normalized];
  if (!mapped) {
    logger.warn(`[ShadowfaxResponseMapper] Encountered unmapped status "${rawStatus}". Defaulting to "in_transit".`);
    return 'in_transit';
  }
  return mapped;
};

module.exports = {
  mapStatus,
  statusMapping,
};
