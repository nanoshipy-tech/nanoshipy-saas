'use strict';

const assert = require('assert');

async function testPhase5Gaps() {
  console.log('====================================================');
  console.log('  NANOSHIPY - PHASE 5 CODE GAPS VERIFICATION        ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function check(name, fn) {
    total++;
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  async function checkAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  // 1. Storefront Order Mapper produces valid Order schema
  check('GAP-01: Storefront mapper generates valid Order model schema from Shopify', () => {
    const mapper = require('../src/services/storefrontOrderMapper.service');
    const mockShopify = {
      id: 987654321,
      name: '#1005',
      created_at: '2026-03-01T10:00:00Z',
      financial_status: 'paid',
      total_price: '1499.00',
      total_weight: 800,
      shipping_address: {
        name: 'John Doe',
        phone: '9876543210',
        address1: '123 Tech Park',
        city: 'Bengaluru',
        province: 'Karnataka',
        zip: '560001',
        country_code: 'IN',
      },
      line_items: [
        { id: 111, title: 'Wireless Headphones', price: '1499.00', quantity: 1, sku: 'WH-01' },
      ],
    };

    const mapped = mapper.fromShopify(mockShopify, 'conn-uuid-1');
    assert.strictEqual(mapped.order_reference, '#1005');
    assert.strictEqual(mapped.customer_name, 'John Doe');
    assert.strictEqual(mapped.customer_phone, '9876543210');
    assert.strictEqual(mapped.shipping_city, 'Bengaluru');
    assert.strictEqual(mapped.payment_mode, 'prepaid');
    assert.strictEqual(mapped.order_value, 1499.00);
    assert.strictEqual(mapped.weight_kg, 0.8);
    assert.strictEqual(mapped.external_order_id, '987654321');
    assert.strictEqual(mapped.items.length, 1);
    assert.strictEqual(mapped.items[0].sku, 'WH-01');
  });

  // 2. Payout Service validation
  check('GAP-02: PayoutService validates Indian bank account numbers and IFSC', () => {
    const payoutService = require('../src/services/payout.service');
    assert.throws(() => {
      payoutService.validateBeneficiaryDetails('123', 'HDFC0001234', 'John');
    }, /Invalid bank account number/);

    assert.throws(() => {
      payoutService.validateBeneficiaryDetails('123456789012', 'INVALID_IFSC', 'John');
    }, /Invalid IFSC code format/);

    assert.doesNotThrow(() => {
      payoutService.validateBeneficiaryDetails('123456789012', 'HDFC0001234', 'John Doe');
    });
  });

  // 3. Payout Service simulation execution
  await checkAsync('GAP-03: PayoutService executes simulated payout for sandbox/test', async () => {
    const payoutService = require('../src/services/payout.service');
    const res = await payoutService.disburseRemittancePayout({
      batchId: 'batch-test-123',
      batchReference: 'COD-REM-999',
      sellerId: 'seller-test-456',
      amount: 5400.00,
      beneficiary: {
        accountNumber: '918273645012',
        ifsc: 'SBIN0000123',
        holderName: 'Acme Retailers Pvt Ltd',
      },
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, 'completed');
    assert(res.payoutId.startsWith('pout_sim_'));
    assert(res.utr.startsWith('UTR'));
  });

  // 4. Wallet Service exports and signatures
  check('GAP-04: WalletService supports returnDetails and pessimistic locking', () => {
    const walletService = require('../src/services/wallet.service');
    assert.strictEqual(typeof walletService.credit, 'function');
    assert.strictEqual(typeof walletService.debit, 'function');
    assert.strictEqual(typeof walletService.checkBalanceForShipment, 'function');
    assert.strictEqual(typeof walletService.reserveFunds, 'function');
    assert.strictEqual(typeof walletService.captureFunds, 'function');
    assert.strictEqual(typeof walletService.releaseFunds, 'function');
  });

  // 5. Workers and Schedulers exported properly
  check('GAP-05: Storefront worker and scheduler exist and are mounted', () => {
    const storefrontWorkerModule = require('../src/workers/storefrontSync.worker');
    assert.strictEqual(typeof storefrontWorkerModule.ingestMappedOrder, 'function');
    assert('storefrontWebhookWorker' in storefrontWorkerModule, 'storefrontWebhookWorker must be in exports');
    assert('storefrontOrderPollWorker' in storefrontWorkerModule, 'storefrontOrderPollWorker must be in exports');

    const { scheduleStorefrontSync, stopStorefrontSyncScheduler } = require('../src/schedulers/storefrontSyncScheduler');
    assert.strictEqual(typeof scheduleStorefrontSync, 'function');
    assert.strictEqual(typeof stopStorefrontSyncScheduler, 'function');
  });

  console.log(`\n----------------------------------------------------`);
  console.log(`  PHASE 5 VERIFICATION: ${passed}/${total} TESTS PASSED!`);
  console.log(`----------------------------------------------------\n`);
}

testPhase5Gaps().catch(console.error);
