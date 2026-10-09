'use strict';

const { getPincodeLocation } = require('./zoneResolver');
const logger = require('../utils/logger');

/**
 * Checks if a given Indian pincode or state belongs to Tamil Nadu.
 * Tamil Nadu pincode range: 600000 to 643999
 *
 * @param {string|number} pincode
 * @param {string} [state]
 * @returns {boolean}
 */
function isTamilNaduPincode(pincode, state = '') {
  if (state && typeof state === 'string') {
    const s = state.toLowerCase().trim();
    if (s === 'tamil nadu' || s === 'tamilnadu' || s === 'tn') {
      return true;
    }
  }

  if (!pincode) return false;
  const pStr = String(pincode).trim();
  const pNum = parseInt(pStr, 10);

  if (!isNaN(pNum) && pNum >= 600000 && pNum <= 643999) {
    return true;
  }

  // Check by prefix
  if (pStr.startsWith('60') || pStr.startsWith('61') || pStr.startsWith('62') || pStr.startsWith('63') || pStr.startsWith('64')) {
    if (pNum >= 600000 && pNum <= 643999) {
      return true;
    }
  }

  return false;
}

/**
 * Determines the target courier provider key based on geographic routing:
 * - Intra-Tamil Nadu (both origin & destination in TN) -> 'stcourier' (local intra-state network)
 * - All other routes (Inter-state / Rest of India) -> 'shipway' (National Express Network)
 *
 * @param {string|number} deliveryPincode
 * @param {string} [deliveryState]
 * @param {string|number} [pickupPincode]
 * @param {string} [pickupState]
 * @returns {Promise<{ providerKey: string, region: string, isLocal: boolean, zoneName: string, routingReason: string }>}
 */
async function determineAssignedCourier(deliveryPincode, deliveryState = '', pickupPincode = null, pickupState = '') {
  let destState = deliveryState;

  if (!destState && deliveryPincode) {
    try {
      const loc = await getPincodeLocation(deliveryPincode);
      destState = loc.state || '';
    } catch (err) {
      logger.warn(`[CourierRouting] Failed to lookup delivery location for pincode ${deliveryPincode}: ${err.message}`);
    }
  }

  const isDestTN = isTamilNaduPincode(deliveryPincode, destState);

  // If pickup is specified, verify that pickup is also within Tamil Nadu
  let isPickupTN = true;
  let origState = pickupState;
  if (pickupPincode) {
    if (!origState) {
      try {
        const loc = await getPincodeLocation(pickupPincode);
        origState = loc.state || '';
      } catch (err) {
        logger.warn(`[CourierRouting] Failed to lookup pickup location for pincode ${pickupPincode}: ${err.message}`);
      }
    }
    isPickupTN = isTamilNaduPincode(pickupPincode, origState);
  }

  const isIntraTN = isDestTN && isPickupTN;

  if (isIntraTN) {
    // Check if destination pincode is specifically serviceable by ST Courier
    let isStServiceable = true;
    let serviceabilityReason = 'Intra-Tamil Nadu shipment allocated to ST Courier network';

    try {
      const { StCourierServiceablePincode } = require('../models');
      if (StCourierServiceablePincode && deliveryPincode) {
        const totalConfigured = await StCourierServiceablePincode.count({ where: { is_active: true } });
        if (totalConfigured > 0) {
          const pinStr = String(deliveryPincode).trim();
          const match = await StCourierServiceablePincode.findOne({
            where: {
              pincode: pinStr,
              is_active: true,
            },
          });

          if (!match) {
            isStServiceable = false;
            serviceabilityReason = `Tamil Nadu destination pincode ${pinStr} is not in ST Courier serviceable network; automatically routed to Shipway National Express Network`;
          } else {
            serviceabilityReason = `Intra-Tamil Nadu shipment to serviceable pincode ${pinStr} (${match.district || match.city || 'TN'}) allocated to ST Courier`;
          }
        }
      }
    } catch (err) {
      logger.warn(`[CourierRouting] ST Courier serviceable pincode lookup warning: ${err.message}`);
    }

    if (isStServiceable) {
      return {
        providerKey: 'stcourier',
        region: 'Tamil Nadu',
        isLocal: true,
        zoneName: 'Intra-State / Tamil Nadu (ST Courier)',
        routingReason: serviceabilityReason,
      };
    }

    // Auto-route non-serviceable Tamil Nadu pincodes to Shipway
    return {
      providerKey: 'shipway',
      region: 'Tamil Nadu (Shipway Express)',
      isLocal: false,
      zoneName: 'Tamil Nadu Non-ST Courier Serviceable Zone (Shipway)',
      routingReason: serviceabilityReason,
    };
  }

  return {
    providerKey: 'shipway',
    region: destState || 'Rest of India',
    isLocal: false,
    zoneName: 'National Express Network',
    routingReason: isDestTN && !isPickupTN
      ? 'Origin is outside Tamil Nadu; allocated to National Express Network'
      : 'Destination is outside Tamil Nadu; allocated to National Express Network',
  };
}

/**
 * Returns active routing rule configuration for Admin view.
 */
function getRoutingRules() {
  return {
    rules: [
      {
        id: 'RULE-TN-INTRA-STCOURIER',
        name: 'Tamil Nadu Intra-State Routing (ST Courier)',
        criteria: 'Origin AND Destination in Tamil Nadu (Pincodes 600000 - 643999 / State TN)',
        assignedCourier: 'stcourier',
        assignedCourierName: 'ST Courier (Tamil Nadu Network)',
        enabled: true,
        priority: 1,
      },
      {
        id: 'RULE-ROI-NATIONAL',
        name: 'National / Rest of India Express Routing',
        criteria: 'All Interstate / Non-TN Pincodes & States',
        assignedCourier: 'shipway',
        assignedCourierName: 'National Express Network (Delhivery, Blue Dart, Xpressbees)',
        enabled: true,
        priority: 2,
      },
    ],
  };
}

module.exports = {
  isTamilNaduPincode,
  determineAssignedCourier,
  getRoutingRules,
};
