'use strict';

/**
 * Known Shipway Carrier IDs mapped to clean service titles
 */
const SHIPWAY_CARRIER_ID_MAP = {
  '80622': 'Delhivery Surface',
  '7442':  'Delhivery Express',
  '80734': 'Delhivery Surface',
  '80977': 'Delhivery Surface',
  '7613':  'Delhivery Surface',
  '7666':  'Delhivery Surface',
  '81769': 'Blue Dart Surface',
  '7377':  'Blue Dart Express',
  '80593': 'XpressBees Surface',
  '80652': 'XpressBees Air Priority',
  '79681': 'Shadowfax Surface',
  '79930': 'Shadowfax Surface',
  '71468': 'Ekart Surface',
  '80275': 'Ekart Surface',
  '81514': 'Ekart Express',
  '80063': 'Ekart Surface',
  '80064': 'Ekart Surface',
  '82861': 'Ekart Logistics',
  '19339': 'Amazon Shipping',
  '80800': 'DTDC Express',
};

/**
 * Clean SVG logo mapping by carrier ID / service type
 */
const CARRIER_ID_LOGOS = {
  '80622': '/couriers/delhivery.svg',
  '7442':  '/couriers/delhivery.svg',
  '80734': '/couriers/delhivery.svg',
  '80977': '/couriers/delhivery.svg',
  '7613':  '/couriers/delhivery.svg',
  '7666':  '/couriers/delhivery.svg',
  '81769': '/couriers/bluedart.svg',
  '7377':  '/couriers/bluedart.svg',
  '80593': '/couriers/xpressbees.svg',
  '80652': '/couriers/xpressbees.svg',
  '79681': '/couriers/shadowfax.svg',
  '79930': '/couriers/shadowfax.svg',
  '71468': '/couriers/ekart.svg',
  '80275': '/couriers/ekart.svg',
  '81514': '/couriers/ekart.svg',
  '80063': '/couriers/ekart.svg',
  '80064': '/couriers/ekart.svg',
  '82861': '/couriers/ekart.svg',
  '19339': '/couriers/amazon.svg',
  '80800': '/couriers/dtdc.svg',
};

/**
 * Clean SVG logo mapping by courier name keyword
 */
const COURIER_NAME_LOGOS = [
  { match: 'delhivery', logo: '/couriers/delhivery.svg' },
  { match: 'bluedart', logo: '/couriers/bluedart.svg' },
  { match: 'blue dart', logo: '/couriers/bluedart.svg' },
  { match: 'dart', logo: '/couriers/bluedart.svg' },
  { match: 'dtdc', logo: '/couriers/dtdc.svg' },
  { match: 'xpressbees', logo: '/couriers/xpressbees.svg' },
  { match: 'xpress bees', logo: '/couriers/xpressbees.svg' },
  { match: 'xpress-bees', logo: '/couriers/xpressbees.svg' },
  { match: 'bees', logo: '/couriers/xpressbees.svg' },
  { regex: /\bxpress\b/, logo: '/couriers/xpressbees.svg' },
  { match: 'shadowfax', logo: '/couriers/shadowfax.svg' },
  { match: 'ekart', logo: '/couriers/ekart.svg' },
  { match: 'ecomexpress', logo: '/couriers/ecomexpress.svg' },
  { match: 'ecom express', logo: '/couriers/ecomexpress.svg' },
  { match: 'ecom', logo: '/couriers/ecomexpress.svg' },
  { match: 'st courier', logo: '/couriers/stcourier.svg' },
  { match: 'stcourier', logo: '/couriers/stcourier.svg' },
  { match: 'tamil', logo: '/couriers/stcourier.svg' },
  { match: 'amazon', logo: '/couriers/amazon.svg' },
  { match: 'india post', logo: '/couriers/indiapost.svg' },
  { match: 'indiapost', logo: '/couriers/indiapost.svg' },
  { match: 'smartr', logo: '/couriers/smartr.svg' },
  { match: 'fedex', logo: '/couriers/fedex.svg' },
];

/**
 * Resolves a clean courier logo URL, prioritizing carrierId, then courier name keywords.
 * Never leaks internal aggregator logos (like Shipway).
 *
 * @param {string} [carrierName]
 * @param {string} [serviceType]
 * @param {string} [customLogoUrl]
 * @returns {string}
 */
function resolveCleanCarrierLogo(carrierName, serviceType = null, customLogoUrl = null) {
  // If a valid custom logo is provided that is not a placeholder or aggregator logo
  if (customLogoUrl && typeof customLogoUrl === 'string' && customLogoUrl.trim() &&
      !customLogoUrl.includes('logo.clearbit.com') && !customLogoUrl.includes('shipway')) {
    return customLogoUrl;
  }

  const sType = String(serviceType || '').trim();
  if (sType && CARRIER_ID_LOGOS[sType]) {
    return CARRIER_ID_LOGOS[sType];
  }

  if (carrierName && typeof carrierName === 'string') {
    const lower = carrierName.toLowerCase();
    for (const item of COURIER_NAME_LOGOS) {
      if (item.match && lower.includes(item.match)) {
        return item.logo;
      }
      if (item.regex && item.regex.test(lower)) {
        return item.logo;
      }
    }
  }

  return '/logo-compressed.png';
}

/**
 * Sanitizes courier display name by stripping Shipway brand references
 * while strictly preserving specific services, modes, and weight slabs
 * (e.g. "Delhivery Surface", "Delhivery Express", "Delhivery 1 kg").
 *
 * @param {string} [rawName]
 * @param {string} [serviceType]
 * @returns {string}
 */
function sanitizeCourierDisplayName(rawName, serviceType = null) {
  const sType = String(serviceType || '').trim();
  let name = String(rawName || '').trim();

  // Strip Shipway prefix/mentions
  name = name
    .replace(/^Shipway\s*[-–:]?\s*/i, '')
    .replace(/\bShipway\b/gi, '')
    .trim();

  const lower = name.toLowerCase();

  // If completely empty or generic "multi-carrier"
  if (!name || lower === 'multi-carrier') {
    return SHIPWAY_CARRIER_ID_MAP[sType] || 'Delhivery Surface & Express';
  }

  // If plain generic courier name like "delhivery" without any tier or weight (e.g. "delhivery", "bluedart")
  const isPlainBrandOnly = /^(delhivery|bluedart|blue dart|ekart|shadowfax|xpressbees|dtdc|amazon)$/i.test(name);
  if (isPlainBrandOnly && SHIPWAY_CARRIER_ID_MAP[sType]) {
    return SHIPWAY_CARRIER_ID_MAP[sType];
  }

  // If it's just brand + "(0.5kg)" without tier, e.g. "Delhivery (0.5kg)"
  const isBrandWithDefaultHalfKg = /^(delhivery|bluedart|blue dart|ekart|shadowfax)\s*\(\s*0?\.5\s*k?g\s*\)$/i.test(name);
  if (isBrandWithDefaultHalfKg && SHIPWAY_CARRIER_ID_MAP[sType]) {
    return SHIPWAY_CARRIER_ID_MAP[sType];
  }

  return name;
}

module.exports = {
  SHIPWAY_CARRIER_ID_MAP,
  CARRIER_ID_LOGOS,
  resolveCleanCarrierLogo,
  sanitizeCourierDisplayName,
};
