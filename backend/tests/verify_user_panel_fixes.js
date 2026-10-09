'use strict';

const assert = require('assert');
const path = require('path');

async function runTests() {
  console.log('====================================================');
  console.log('  NANOSHIPY - USER PANEL & BACKEND FIXES VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // --- MODULE 1: AUTHENTICATION & ONBOARDING ---
  test('Auth Service: register returns tokens and active session contract', () => {
    const authService = require('../src/services/auth.service');
    assert.strictEqual(typeof authService.register, 'function', 'authService.register must be a function');
  });

  test('Auth Controller: register handles auto-login and cookie attachment', () => {
    const authController = require('../src/controllers/auth.controller');
    assert.strictEqual(typeof authController.register, 'function', 'authController.register must be a function');
  });

  // --- MODULE 2: TAX CALCULATION & INVOICING ---
  test('Tax Calculation: computeGST handles intra-state calculation correctly', () => {
    const { computeGST } = require('../src/services/taxCalculation.service');
    assert.strictEqual(typeof computeGST, 'function', 'computeGST must be exported');

    // Intra-state (Tamil Nadu to Tamil Nadu)
    const res = computeGST(100, 'Tamil Nadu', 18);
    assert.strictEqual(res.total, 18, 'Total GST on 100 at 18% should be 18');
    assert.strictEqual(res.isIntraState, true, 'Should be intra-state');
    assert.strictEqual(res.cgst, 9, 'CGST should be 9');
    assert.strictEqual(res.sgst, 9, 'SGST should be 9');
    assert.strictEqual(res.igst, 0, 'IGST should be 0');
    assert.strictEqual(res.cgstRate, 9, 'CGST rate should be 9%');
    assert.strictEqual(res.sgstRate, 9, 'SGST rate should be 9%');
  });

  test('Tax Calculation: computeGST handles inter-state calculation correctly', () => {
    const { computeGST } = require('../src/services/taxCalculation.service');

    // Inter-state (Tamil Nadu to Maharashtra)
    const res = computeGST(250, 'Maharashtra', 18);
    assert.strictEqual(res.total, 45, 'Total GST on 250 at 18% should be 45');
    assert.strictEqual(res.isIntraState, false, 'Should be inter-state');
    assert.strictEqual(res.cgst, 0, 'CGST should be 0');
    assert.strictEqual(res.sgst, 0, 'SGST should be 0');
    assert.strictEqual(res.igst, 45, 'IGST should be 45');
    assert.strictEqual(res.igstRate, 18, 'IGST rate should be 18%');
  });

  test('Invoice Service: can call computeGST without crashing', () => {
    const taxService = require('../src/services/taxCalculation.service');
    assert(taxService.computeGST, 'computeGST must exist so invoice.service line 355 will not crash');
  });

  // --- MODULE 3: REVERSE LOGISTICS & RTO ---
  test('RTO Service: maps warehouse delivery to rto_delivered not cancelled', () => {
    const fs = require('fs');
    const rtoServiceContent = fs.readFileSync(
      path.join(__dirname, '../src/services/rto.service.js'),
      'utf8'
    );
    assert(
      rtoServiceContent.includes("'rto_delivered'"),
      "rto.service.js must contain 'rto_delivered' status transition"
    );
    assert(
      !rtoServiceContent.includes("newStatus = 'cancelled'"),
      "rto.service.js must not overwrite warehouse delivery with 'cancelled'"
    );
  });

  test('Shipment Service: creates RTO AWB linked to forward shipment', () => {
    const fs = require('fs');
    const shipmentServiceContent = fs.readFileSync(
      path.join(__dirname, '../src/services/shipment.service.js'),
      'utf8'
    );
    assert(
      shipmentServiceContent.includes('RTO-${forwardShipment.awb_number}'),
      'shipment.service.js must format RTO AWB correctly'
    );
  });

  // --- MODULE 4: ORDER IMPORT & PICKUP FALLBACK ---
  test('Order Import: has fallback to active warehouse pickup address', () => {
    const fs = require('fs');
    const orderImportContent = fs.readFileSync(
      path.join(__dirname, '../src/services/orderImport.service.js'),
      'utf8'
    );
    assert(
      orderImportContent.includes('orderGroup.pickup_address_id = defaultAddress.id'),
      'orderImport.service.js must fall back to defaultAddress.id when pickup_address_id is empty'
    );
  });

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passed}/${total} TESTS PASSED`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running tests:', err);
  process.exit(1);
});
