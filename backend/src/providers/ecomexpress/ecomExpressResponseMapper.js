'use strict';

const logger = require('../../utils/logger');

const statusMapping = {
  'manifested': 'awb_generated',
  'registered': 'awb_generated',
  'ready_for_dispatch': 'awb_generated',
  'in_transit': 'in_transit',
  'it': 'in_transit',
  'dispatched': 'in_transit',
  'hub_in': 'in_transit',
  'hub_out': 'in_transit',
  'undelivered': 'undelivered',
  'ud': 'undelivered',
  'failed': 'undelivered',
  'out_for_delivery': 'out_for_delivery',
  'ofd': 'out_for_delivery',
  'delivered': 'delivered',
  'dl': 'delivered',
  'rto': 'rto_initiated',
  'rto_initiated': 'rto_initiated',
  'return_in_transit': 'rto_in_transit',
  'rto_in_transit': 'rto_in_transit',
  'rto_delivered': 'rto_delivered',
  'cancelled': 'cancelled',
};

const mapStatus = (rawStatus) => {
  if (!rawStatus) return 'in_transit';
  const normalized = String(rawStatus).toLowerCase().trim().replace(/[\s-]+/g, '_');
  const mapped = statusMapping[normalized];
  if (!mapped) {
    logger.warn(`[EcomExpressResponseMapper] Encountered unmapped status "${rawStatus}". Defaulting to "in_transit".`);
    return 'in_transit';
  }
  return mapped;
};

module.exports = {
  mapStatus,
  statusMapping,
};
