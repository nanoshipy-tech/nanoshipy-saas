'use strict';

const { PincodeMaster } = require('../models');
const logger = require('../utils/logger');

const METRO_CITIES = [
  'mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore',
  'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad',
  'gurgaon', 'gurugram', 'noida', 'faridabad', 'ghaziabad'
];

const ZONE_E_STATES = [
  'jammu and kashmir', 'jammu & kashmir', 'j&k', 'ladakh',
  'assam', 'meghalaya', 'tripura', 'mizoram', 'manipur',
  'nagaland', 'arunachal pradesh', 'sikkim',
  'andaman and nicobar islands', 'andaman & nicobar', 'lakshadweep'
];

// Special Pincode Prefixes for Zone E (NE & J&K / Islands)
const ZONE_E_PINCODE_PREFIXES = ['19', '78', '79', '73', '74', '79', '90', '91'];

/**
 * Resolve location details (city & state) from pincode.
 */
async function getPincodeLocation(pincode) {
  if (!pincode) return { city: '', state: '', district: '' };

  try {
    const record = await PincodeMaster.findOne({ where: { pincode: String(pincode).trim() } });
    if (record) {
      return {
        city: (record.city || record.district || '').trim(),
        district: (record.district || record.city || '').trim(),
        state: (record.state || '').trim(),
      };
    }
  } catch (err) {
    logger.warn(`[ZoneResolver] Pincode lookup error for ${pincode}: ${err.message}`);
  }

  // Fallback defaults based on known pincode ranges
  const pStr = String(pincode).trim();
  if (pStr.startsWith('11') || pStr.startsWith('120')) return { city: 'Delhi', district: 'Delhi', state: 'Delhi' };
  if (pStr.startsWith('40')) return { city: 'Mumbai', district: 'Mumbai', state: 'Maharashtra' };
  if (pStr.startsWith('56')) return { city: 'Bengaluru', district: 'Bengaluru', state: 'Karnataka' };
  if (pStr.startsWith('60')) return { city: 'Chennai', district: 'Chennai', state: 'Tamil Nadu' };
  if (pStr.startsWith('70')) return { city: 'Kolkata', district: 'Kolkata', state: 'West Bengal' };
  if (pStr.startsWith('50')) return { city: 'Hyderabad', district: 'Hyderabad', state: 'Telangana' };

  return { city: '', state: '', district: '' };
}

/**
 * Resolve Zone (A, B, C, D, E) for a given pickup & delivery pincode pair.
 * 
 * - Zone A: Within City
 * - Zone B: Within State (Same State, different City)
 * - Zone C: Metro to Metro
 * - Zone D: Rest of India
 * - Zone E: NE, J&K, Special & Island States
 */
async function resolveZone(pickupPincode, deliveryPincode) {
  const pStr = String(pickupPincode || '').trim();
  const dStr = String(deliveryPincode || '').trim();

  // Check Zone E pincode prefixes directly
  const isPickupZoneE = ZONE_E_PINCODE_PREFIXES.some(prefix => pStr.startsWith(prefix));
  const isDeliveryZoneE = ZONE_E_PINCODE_PREFIXES.some(prefix => dStr.startsWith(prefix));

  const pickupLoc = await getPincodeLocation(pStr);
  const deliveryLoc = await getPincodeLocation(dStr);

  const pCity = pickupLoc.city.toLowerCase();
  const dCity = deliveryLoc.city.toLowerCase();
  const pDistrict = (pickupLoc.district || '').toLowerCase();
  const dDistrict = (deliveryLoc.district || '').toLowerCase();
  const pState = pickupLoc.state.toLowerCase();
  const dState = deliveryLoc.state.toLowerCase();

  // Zone A: Same City, Same District, or intra-Delhi
  if (
    (pCity && dCity && pCity === dCity) ||
    (pDistrict && dDistrict && pDistrict === dDistrict) ||
    (pState === 'delhi' && dState === 'delhi') ||
    (pCity.includes('delhi') && dCity.includes('delhi'))
  ) {
    return 'A';
  }

  // Zone E: NE, J&K, Islands
  if (
    isPickupZoneE || isDeliveryZoneE ||
    ZONE_E_STATES.some(s => pState.includes(s)) ||
    ZONE_E_STATES.some(s => dState.includes(s))
  ) {
    return 'E';
  }

  // Zone B: Same State
  if (pState && dState && pState === dState) {
    return 'B';
  }

  // Zone C: Metro to Metro
  const isPickupMetro = METRO_CITIES.includes(pCity);
  const isDeliveryMetro = METRO_CITIES.includes(dCity);
  if (isPickupMetro && isDeliveryMetro) {
    return 'C';
  }

  // Zone D: Rest of India
  return 'D';
}

module.exports = {
  resolveZone,
  getPincodeLocation,
  METRO_CITIES,
  ZONE_E_STATES,
};
