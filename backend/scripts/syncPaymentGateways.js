'use strict';
require('dotenv').config();
const sequelize = require('../src/config/db.config');
const { PaymentGateway, WalletRechargeTransaction } = require('../src/models');

async function syncAndSeedGateways() {
  try {
    await sequelize.authenticate();
    console.log('Syncing PaymentGateway & WalletRechargeTransaction models...');

    await PaymentGateway.sync({ alter: true });
    await WalletRechargeTransaction.sync({ alter: true });

    // Seed default gateways if empty
    const count = await PaymentGateway.count();
    if (count === 0) {
      console.log('Seeding default Payment Gateways...');
      await PaymentGateway.bulkCreate([
        {
          name: 'razorpay',
          display_name: 'Razorpay',
          mode: 'test',
          is_active: true,
          is_default: true,
          config: {
            min_recharge: 500,
            max_recharge: 100000,
            presets: [500, 1000, 2000, 5000],
            fee_percent: 0,
            auto_gst_invoice: true,
          },
        },
        {
          name: 'cashfree',
          display_name: 'Cashfree Payments',
          mode: 'test',
          is_active: false,
          is_default: false,
          config: {
            min_recharge: 500,
            max_recharge: 100000,
            presets: [500, 1000, 2000, 5000],
            fee_percent: 0,
            auto_gst_invoice: true,
          },
        },
        {
          name: 'payu',
          display_name: 'PayU India',
          mode: 'test',
          is_active: false,
          is_default: false,
          config: {
            min_recharge: 500,
            max_recharge: 100000,
            presets: [500, 1000, 2000, 5000],
            fee_percent: 0,
            auto_gst_invoice: true,
          },
        },
        {
          name: 'manual',
          display_name: 'Bank Transfer / Manual Credit',
          mode: 'live',
          is_active: true,
          is_default: false,
          config: {
            min_recharge: 100,
            max_recharge: 500000,
            presets: [1000, 5000, 10000, 50000],
            fee_percent: 0,
            auto_gst_invoice: true,
          },
        },
      ]);
      console.log('Successfully seeded 4 payment gateways (Razorpay default).');
    } else {
      console.log(`PaymentGateways table already contains ${count} rows.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed to sync/seed payment gateways:', err);
    process.exit(1);
  }
}

syncAndSeedGateways();
