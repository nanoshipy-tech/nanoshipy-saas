'use strict';

const assert = require('assert');
const {
  sanitizeCourierDisplayName,
  resolveCleanCarrierLogo,
  SHIPWAY_CARRIER_ID_MAP,
  CARRIER_ID_LOGOS,
} = require('../../src/utils/courierBranding.util');

describe('Courier Names & Logo Resolution Verification', () => {
  it('should preserve specific service titles without mentioning Shipway', () => {
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Delhivery Surface', '80622'),
      'Delhivery Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Delhivery Express', '7442'),
      'Delhivery Express'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Delhivery 1 kg', '80622'),
      'Delhivery 1 kg'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Delhivery (1.0 kg)', '80622'),
      'Delhivery (1.0 kg)'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Blue Dart Surface', '81769'),
      'Blue Dart Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Xpressbees Surface', '80593'),
      'Xpressbees Surface'
    );
  });

  it('should map generic parent name "Delhivery" to specific service based on carrierId', () => {
    assert.strictEqual(
      sanitizeCourierDisplayName('Delhivery (0.5kg)', '80622'),
      'Delhivery Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Bluedart (0.5kg)', '81769'),
      'Blue Dart Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Ekart (0.5kg)', '71468'),
      'Ekart Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('Ekart Surface (1 kg)', '80275'),
      'Ekart Surface (1 kg)'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('delhivery', '7442'),
      'Delhivery Express'
    );
  });

  it('should map generic "Multi-Carrier" or empty string to fallback', () => {
    assert.strictEqual(
      sanitizeCourierDisplayName('Shipway Multi-Carrier', '80622'),
      'Delhivery Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('', '80622'),
      'Delhivery Surface'
    );
    assert.strictEqual(
      sanitizeCourierDisplayName('', 'unknown_id'),
      'Delhivery Surface & Express'
    );
  });

  it('should resolve correct logos by courier name keywords', () => {
    assert.strictEqual(resolveCleanCarrierLogo('Delhivery Surface'), '/couriers/delhivery.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Delhivery Express'), '/couriers/delhivery.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Delhivery 1 kg'), '/couriers/delhivery.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Blue Dart Surface'), '/couriers/bluedart.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Xpressbees Air'), '/couriers/xpressbees.svg');
    assert.strictEqual(resolveCleanCarrierLogo('ST Courier Tamil Nadu'), '/couriers/stcourier.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Shadowfax Surface'), '/couriers/shadowfax.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Ekart Logistics'), '/couriers/ekart.svg');
    assert.strictEqual(resolveCleanCarrierLogo('DTDC Express'), '/couriers/dtdc.svg');
    assert.strictEqual(resolveCleanCarrierLogo('Amazon Shipping'), '/couriers/amazon.svg');
  });

  it('should resolve correct logos by carrier ID if name is generic or missing', () => {
    assert.strictEqual(resolveCleanCarrierLogo('', '80622'), '/couriers/delhivery.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '7442'), '/couriers/delhivery.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '81769'), '/couriers/bluedart.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '80593'), '/couriers/xpressbees.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '79681'), '/couriers/shadowfax.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '82861'), '/couriers/ekart.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '19339'), '/couriers/amazon.svg');
    assert.strictEqual(resolveCleanCarrierLogo('', '80800'), '/couriers/dtdc.svg');
  });

  it('should never return shipway logo when carrier is resolved', () => {
    const logo1 = resolveCleanCarrierLogo('Shipway Delhivery Surface', '80622');
    assert.strictEqual(logo1, '/couriers/delhivery.svg');
    assert.doesNotMatch(logo1, /shipway/i);
  });
});
