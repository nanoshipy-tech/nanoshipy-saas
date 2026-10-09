'use strict';

const REASON_CODES = {
  CUSTOMER_UNAVAILABLE: 'CUSTOMER_UNAVAILABLE',
  ADDRESS_INCORRECT: 'ADDRESS_INCORRECT',
  CUSTOMER_REFUSED: 'CUSTOMER_REFUSED',
  COD_NOT_READY: 'COD_NOT_READY',
  OTHER: 'OTHER',
};

const RTO_STATUSES = {
  RTO_INITIATED: 'rto_initiated',
  RTO_IN_TRANSIT: 'rto_in_transit',
  RTO_DELIVERED: 'rto_delivered',
  RTO_LOST: 'rto_lost',
};

// Keyword patterns to auto-detect NDR reasons from raw status and remarks
const NDR_PATTERNS = [
  {
    code: REASON_CODES.CUSTOMER_UNAVAILABLE,
    keywords: ['unavailable', 'unreachable', 'not available', 'door closed', 'consignee absent', 'not present', 'could not reach', 'no response'],
  },
  {
    code: REASON_CODES.ADDRESS_INCORRECT,
    keywords: ['incorrect address', 'incomplete address', 'wrong address', 'address incorrect', 'address issue', 'bad address', 'pincode wrong', 'wrong pincode'],
  },
  {
    code: REASON_CODES.CUSTOMER_REFUSED,
    keywords: ['refused', 'rejected', 'customer refused', 'consignee refused', 'consignee rejected', 'cancelled by customer'],
  },
  {
    code: REASON_CODES.COD_NOT_READY,
    keywords: ['cod amount not ready', 'cash not ready', 'money not ready', 'cod not ready', 'payment not ready', 'amount not ready'],
  },
];

// Keywords to detect courier-initiated reverse logistics (RTO)
const RTO_PATTERNS = [
  { status: RTO_STATUSES.RTO_INITIATED, keywords: ['rto initiated', 'rto created', 'return initiated', 'return created', 'undelivered return'] },
  { status: RTO_STATUSES.RTO_IN_TRANSIT, keywords: ['rto in transit', 'rto transit', 'return in transit', 'return transit', 'returning to origin', 'sent back to origin'] },
  { status: RTO_STATUSES.RTO_DELIVERED, keywords: ['rto delivered', 'returned to origin', 'returned back to merchant', 'delivered to origin', 'return delivered'] },
  { status: RTO_STATUSES.RTO_LOST, keywords: ['rto lost', 'return lost', 'lost in return'] }
];

/**
 * Determine if a tracking status/remark indicates an NDR state, returning the reason code.
 * Returns null if it is not an NDR state.
 */
function detectNdrReason(rawStatus, remark) {
  const text = `${rawStatus || ''} ${remark || ''}`.toLowerCase();
  
  // NDR events only trigger on undelivered/failed/attempted checks
  const isDeliveryFailureText = ['undelivered', 'failed attempt', 'delivery failed', 'attempted', 'failed', 'could not deliver', 'held', 'delay'].some(kw => text.includes(kw));
  if (!isDeliveryFailureText) {
    return null;
  }

  for (const pattern of NDR_PATTERNS) {
    if (pattern.keywords.some(kw => text.includes(kw))) {
      return pattern.code;
    }
  }

  return REASON_CODES.OTHER;
}

/**
 * Determine if a tracking status/remark indicates RTO movement.
 * Returns standard RTO status or null.
 */
function detectRtoStatus(rawStatus, remark) {
  const text = `${rawStatus || ''} ${remark || ''}`.toLowerCase();

  for (const pattern of RTO_PATTERNS) {
    if (pattern.keywords.some(kw => text.includes(kw))) {
      return pattern.status;
    }
  }

  return null;
}

module.exports = {
  REASON_CODES,
  RTO_STATUSES,
  detectNdrReason,
  detectRtoStatus,
};
