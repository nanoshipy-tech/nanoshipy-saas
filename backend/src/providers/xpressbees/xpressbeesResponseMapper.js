'use strict';

const logger = require('../../utils/logger');

const statusMapping = {
  'manifested': 'awb_generated',
  'registered': 'awb_generated',
  'order_created': 'awb_generated',
  'pickup_scheduled': 'awb_generated',
  'in_transit': 'in_transit',
  'intransit': 'in_transit',
  'reached_at_destination': 'in_transit',
  'dispatched': 'in_transit',
  'bagged': 'in_transit',
  'undelivered': 'undelivered',
  'attempted': 'undelivered',
  'delivery_failed': 'undelivered',
  'out_for_delivery': 'out_for_delivery',
  'ofd': 'out_for_delivery',
  'delivered': 'delivered',
  'rto_initiated': 'rto_initiated',
  'rto': 'rto_initiated',
  'return_to_origin': 'rto_initiated',
  'rto_in_transit': 'rto_in_transit',
  'rto_delivered': 'rto_delivered',
  'cancelled': 'cancelled',
  'closed': 'cancelled',
};

const mapStatus = (rawStatus) => {
  if (!rawStatus) return 'in_transit';
  const normalized = String(rawStatus).toLowerCase().trim().replace(/[\s-]+/g, '_');
  const mapped = statusMapping[normalized];
  if (!mapped) {
    logger.warn(`[XpressbeesResponseMapper] Encountered unmapped status "${rawStatus}". Defaulting to "in_transit".`);
    return 'in_transit';
  }
  return mapped;
};

module.exports = {
  mapStatus,
  statusMapping,
};
