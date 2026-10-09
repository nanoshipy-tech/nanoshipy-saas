export const CARRIER_ID_LOGOS: Record<string, string> = {
  '80622': '/couriers/delhivery.svg', // Delhivery Surface
  '7442':  '/couriers/delhivery.svg', // Delhivery Express
  '80734': '/couriers/delhivery.svg', // Delhivery Surface 1kg
  '80977': '/couriers/delhivery.svg', // Delhivery Surface 2kg
  '7613':  '/couriers/delhivery.svg', // Delhivery Surface 5kg
  '7666':  '/couriers/delhivery.svg', // Delhivery Surface 10kg
  '81769': '/couriers/bluedart.svg',  // Blue Dart Surface
  '7377':  '/couriers/bluedart.svg',  // Blue Dart Express
  '80593': '/couriers/xpressbees.svg',// Xpressbees Surface
  '80652': '/couriers/xpressbees.svg',// Xpressbees Air Priority
  '79681': '/couriers/shadowfax.svg', // Shadowfax Surface
  '79930': '/couriers/shadowfax.svg', // Shadowfax Surface 1kg
  '71468': '/couriers/ekart.svg',     // Ekart Surface
  '80275': '/couriers/ekart.svg',     // Ekart Surface 1kg
  '81514': '/couriers/ekart.svg',     // Ekart Express
  '80063': '/couriers/ekart.svg',     // Ekart Surface 5kg
  '80064': '/couriers/ekart.svg',     // Ekart Surface 10kg
  '82861': '/couriers/ekart.svg',     // Ekart Logistics
  '19339': '/couriers/amazon.svg',    // Amazon Shipping
  '80800': '/couriers/dtdc.svg',      // DTDC Express
};

export const DEFAULT_COURIER_LOGOS: Record<string, string> = {
  delhivery: '/couriers/delhivery.svg',
  bluedart: '/couriers/bluedart.svg',
  'blue dart': '/couriers/bluedart.svg',
  xpressbees: '/couriers/xpressbees.svg',
  'xpress bees': '/couriers/xpressbees.svg',
  shadowfax: '/couriers/shadowfax.svg',
  ekart: '/couriers/ekart.svg',
  dtdc: '/couriers/dtdc.svg',
  ecomexpress: '/couriers/ecomexpress.svg',
  'ecom express': '/couriers/ecomexpress.svg',
  stcourier: '/couriers/stcourier.svg',
  'st courier': '/couriers/stcourier.svg',
  amazon: '/couriers/amazon.svg',
  'amazon shipping': '/couriers/amazon.svg',
  indiapost: '/couriers/indiapost.svg',
  'india post': '/couriers/indiapost.svg',
  nanoshipy: '/logo.png',
  smartr: '/couriers/smartr.svg',
  fedex: '/couriers/fedex.svg',
};

export function resolveCourierLogo(
  nameOrKey?: string | null,
  customLogoUrl?: string | null,
  serviceType?: string | null
): string {
  if (customLogoUrl && customLogoUrl.trim() && !customLogoUrl.includes('logo.clearbit.com')) {
    if (customLogoUrl.startsWith('/uploads/') || customLogoUrl.startsWith('http') || !customLogoUrl.endsWith('shipway.svg')) {
      return customLogoUrl;
    }
  }

  // 1. Match by carrierId / serviceType if numeric
  const sType = String(serviceType || '').trim();
  if (sType && CARRIER_ID_LOGOS[sType]) {
    return CARRIER_ID_LOGOS[sType];
  }

  if (!nameOrKey) return '/logo.png';
  const clean = nameOrKey.toLowerCase().trim();

  // 2. Match if nameOrKey is carrier ID
  if (CARRIER_ID_LOGOS[clean]) {
    return CARRIER_ID_LOGOS[clean];
  }

  // 3. Match courier name substrings
  for (const [k, v] of Object.entries(DEFAULT_COURIER_LOGOS)) {
    if (clean.includes(k)) return v;
  }

  return '/logo.png';
}
