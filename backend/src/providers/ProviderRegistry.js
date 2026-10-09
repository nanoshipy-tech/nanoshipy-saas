'use strict';

const MockProviderAdapter = require('./mock/MockProviderAdapter');
const ShipwayAdapter = require('./shipway/ShipwayAdapter');
const DelhiveryAdapter = require('./delhivery/DelhiveryAdapter');
const BluedartAdapter = require('./bluedart/BluedartAdapter');
const XpressbeesAdapter = require('./xpressbees/XpressbeesAdapter');
const EcomExpressAdapter = require('./ecomexpress/EcomExpressAdapter');
const ShadowfaxAdapter = require('./shadowfax/ShadowfaxAdapter');
const STCourierAdapter = require('./stcourier/STCourierAdapter');

/**
 * ProviderRegistry
 *
 * Central source of truth mapping provider keys to their adapter classes.
 */
const registry = {
  mock: MockProviderAdapter,
  shipway: ShipwayAdapter,
  delhivery: DelhiveryAdapter,
  bluedart: BluedartAdapter,
  xpressbees: XpressbeesAdapter,
  ecomexpress: EcomExpressAdapter,
  shadowfax: ShadowfaxAdapter,
  stcourier: STCourierAdapter,
};

module.exports = registry;

