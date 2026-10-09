'use strict';

const { v4: uuidv4 } = require('uuid');
const { sequelize, Tenant, Wallet, SellerPaymentProfile, PostpaidTransaction } = require('../src/models');
const walletService = require('../src/services/wallet.service');
const SellerPaymentService = require('../src/services/sellerPayment.service');
const { InsufficientBalanceError } = require('../src/utils/errors');

async function runRaceConditionTests() {
  console.log('=== CONCURRENCY & RACE CONDITION TEST SUITE ===');

  await sequelize.authenticate();
  console.log('Database connected.');

  // Create a parent test tenant
  const testTenant = await Tenant.create({
    id: uuidv4(),
    company_name: 'Concurrency Test Merchant',
    subdomain: `test-${Date.now()}`,
    status: 'active',
  });
  console.log(`Created test tenant: ${testTenant.id}`);

  try {
    // Test 1: Wallet Concurrent Reservation Race
    console.log('\n--- Test 1: Concurrent Prepaid Wallet Reservation ---');
    const testWallet = await Wallet.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      balance: 100.00,
      held_balance: 0.00,
      credit_limit: 0.00,
      low_balance_threshold: 10.00,
    });

    console.log(`Created test wallet ${testWallet.id} with balance: ₹100.00`);

    // Launch two simultaneous reservations of ₹70 each
    console.log('Firing 2 concurrent reservation requests of ₹70 each...');
    const results1 = await Promise.allSettled([
      walletService.reserveFunds(testTenant.id, 70.00, 'freight_reserve', uuidv4()),
      walletService.reserveFunds(testTenant.id, 70.00, 'freight_reserve', uuidv4()),
    ]);

    const fulfilled1 = results1.filter(r => r.status === 'fulfilled');
    const rejected1 = results1.filter(r => r.status === 'rejected');

    console.log(`Results: ${fulfilled1.length} succeeded, ${rejected1.length} rejected.`);
    if (fulfilled1.length === 1 && rejected1.length === 1) {
      console.log('PASS: Exactly 1 reservation succeeded, 1 was rejected due to row lock.');
      console.log('Rejection reason:', rejected1[0].reason?.message || rejected1[0].reason);
    } else {
      throw new Error(`FAIL: Expected 1 success and 1 rejection, got ${fulfilled1.length} succeeded!`);
    }

    // Check final wallet state
    const reloadedWallet = await Wallet.findByPk(testWallet.id);
    console.log(`Final wallet held_balance: ₹${reloadedWallet.held_balance} (Expected ₹70.00)`);
    if (parseFloat(reloadedWallet.held_balance) !== 70.00) {
      throw new Error(`FAIL: Expected held_balance 70.00, got ${reloadedWallet.held_balance}`);
    }

    await testWallet.destroy().catch(() => {});

    // Test 2: Postpaid Credit Limit Concurrent Reservation Race
    console.log('\n--- Test 2: Concurrent Postpaid Credit Limit Reservation ---');
    const profile = await SellerPaymentProfile.create({
      id: uuidv4(),
      tenant_id: testTenant.id,
      payment_mode: 'postpaid',
      credit_limit: 100.00,
      outstanding_amount: 0.00,
      reserved_credit: 0.00,
      billing_cycle: 'weekly',
      payment_terms_days: 7,
      status: 'active',
    });

    console.log(`Created test postpaid profile with credit limit: ₹100.00`);
    console.log('Firing 2 concurrent postpaid reservation requests of ₹70 each...');

    const results2 = await Promise.allSettled([
      sequelize.transaction(async (t) => {
        return SellerPaymentService.reserveShipmentPayment({
          tenant_id: testTenant.id,
          shipment_id: null,
          amount: 70.00,
          transaction: t,
        });
      }),
      sequelize.transaction(async (t) => {
        return SellerPaymentService.reserveShipmentPayment({
          tenant_id: testTenant.id,
          shipment_id: null,
          amount: 70.00,
          transaction: t,
        });
      }),
    ]);

    const fulfilled2 = results2.filter(r => r.status === 'fulfilled');
    const rejected2 = results2.filter(r => r.status === 'rejected');

    console.log(`Results: ${fulfilled2.length} succeeded, ${rejected2.length} rejected.`);
    if (fulfilled2.length === 1 && rejected2.length === 1) {
      console.log('PASS: Exactly 1 postpaid reservation succeeded, 1 was rejected due to row lock.');
      console.log('Rejection reason:', rejected2[0].reason?.message || rejected2[0].reason);
    } else {
      throw new Error(`FAIL: Expected 1 success and 1 rejection, got ${fulfilled2.length} succeeded!`);
    }

    const reloadedProfile = await SellerPaymentProfile.findByPk(profile.id);
    console.log(`Final profile reserved_credit: ₹${reloadedProfile.reserved_credit} (Expected ₹70.00)`);
    if (parseFloat(reloadedProfile.reserved_credit) !== 70.00) {
      throw new Error(`FAIL: Expected reserved_credit 70.00, got ${reloadedProfile.reserved_credit}`);
    }

    await PostpaidTransaction.destroy({ where: { tenant_id: testTenant.id } }).catch(() => {});
    await profile.destroy().catch(() => {});
  } finally {
    await testTenant.destroy().catch(() => {});
  }

  console.log('\n=== ALL CONCURRENCY & RACE CONDITION TESTS PASSED ===');
}

runRaceConditionTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\nCONCURRENCY TEST FAILED:', err);
  process.exit(1);
});
