'use strict';

const logger = require('../../utils/logger');

const statusMapping = {
  'manifested': 'awb_generated',
  'in transit': 'in_transit',
  'in_transit': 'in_transit',
  'it': 'in_transit',
  'ud': 'undelivered',
  'undelivered': 'undelivered',
  'out for delivery': 'out_for_delivery',
  'out_for_delivery': 'out_for_delivery',
  'ofd': 'out_for_delivery',
  'dl': 'delivered',
  'delivered': 'delivered',
  'rt': 'rto_initiated',
  'rto': 'rto_initiated',
  'rto_initiated': 'rto_initiated',
  'rto_in_transit': 'rto_in_transit',
  'rto_delivered': 'rto_delivered',
  'cancelled': 'cancelled',
  'can': 'cancelled',
};

const mapStatus = (rawStatus) => {
  if (!rawStatus) return 'in_transit';
  const normalized = rawStatus.toLowerCase().trim().replace(/\s+/g, '_');
  const mapped = statusMapping[normalized] || statusMapping[rawStatus.toLowerCase().trim()];
  if (!mapped) {
    logger.warn(`[BluedartResponseMapper] Encountered unmapped status "${rawStatus}". Defaulting to "in_transit".`);
    return 'in_transit';
  }
  return mapped;
};

module.exports = {
  mapStatus,
  statusMapping,
};
