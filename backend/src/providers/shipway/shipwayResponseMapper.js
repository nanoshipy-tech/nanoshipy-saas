'use strict';

const logger = require('../../utils/logger');

// Explicit mapping table from Shipway's raw status codes and strings to standard platform statuses
const statusMapping = {
  // Official Shipway Short Codes
  'sch': 'pickup_scheduled',
  'int': 'in_transit',
  'ofd': 'out_for_delivery',
  'del': 'delivered',
  'pkf': 'failed',
  'pcan': 'cancelled',
  'nfi': 'failed',
  'rto': 'rto_initiated',
  'rtodel': 'rto_delivered',
  'rto_delivered': 'rto_delivered',
  'undelivered': 'ndr_initiated',

  // Official Shipway Forward Shipment Status Text
  'shipment_booked': 'created',
  'new': 'created',
  'pending': 'created',
  'ready': 'awb_generated',
  'awb_generated': 'awb_generated',
  'pickup_scheduled': 'pickup_scheduled',
  'scheduled': 'pickup_scheduled',
  'out_for_pickup': 'pickup_scheduled',
  'pickup_delayed': 'pickup_scheduled',
  'pickup_rescheduled': 'pickup_scheduled',
  'picked_up': 'picked_up',
  'pickup': 'picked_up',
  'shipment_picked_up': 'picked_up',
  'pick_up_failed': 'failed',
  'pickup_failed': 'failed',
  'pick_up_cancelled': 'cancelled',
  'pickup_cancelled': 'cancelled',
  'in_transit': 'in_transit',
  'transit': 'in_transit',
  'out_for_delivery': 'out_for_delivery',
  'delivered': 'delivered',
  'cancelled': 'cancelled',
  'canceled': 'cancelled',
  'failed': 'failed',
  'returned': 'rto_initiated',
  'ndr': 'ndr_initiated',

  // Official Shipway Reverse / Returns Shipment Statuses
  'return_in_transit': 'rto_in_transit',
  'return_delivered': 'rto_delivered',
  'return_out_for_delivery': 'rto_in_transit',
  'reverse_pickup_exception': 'failed',
  'return_undelivered': 'ndr_initiated',
  'return_request_cancelled': 'cancelled',
  'return_request_closed': 'rto_delivered',
};

/**
 * Normalizes a raw Shipway status string/code to standard platform shipment status enum.
 *
 * @param {string} rawStatus
 * @returns {string}
 */
const mapStatus = (rawStatus) => {
  if (!rawStatus) {
    logger.warn('[ShipwayResponseMapper] Received empty rawStatus. Flagging for manual review.');
    return 'unmapped_review_needed';
  }
  const normalized = String(rawStatus).toLowerCase().trim().replace(/[\s\-_]+/g, '_');
  const mapped = statusMapping[normalized] || statusMapping[normalized.replace(/_/g, '')];
  if (!mapped) {
    logger.error(`[ShipwayResponseMapper][UNMAPPED_STATUS_ALERT] Encountered unmapped status "${rawStatus}". Flagged for manual review.`);
    return 'unmapped_review_needed';
  }
  return mapped;
};

module.exports = {
  mapStatus,
  statusMapping,
};
