'use strict';

require('dotenv').config();
const { sequelize, User, Tenant, Role, PaymentGateway, CourierProvider, PlatformAdmin, Wallet } = require('./src/models');
const hashUtils = require('./src/utils/hash');

async function seedLocal() {
  console.log('>>> Syncing local SQLite database...');
  await sequelize.sync({ force: false });

  // 1. Ensure Platform Admin
  let admin = await PlatformAdmin.findOne({ where: { email: 'admin@nanoshipy.com' } });
  if (!admin) {
    const password_hash = await hashUtils.hashPassword('admin@123');
    admin = await PlatformAdmin.create({
      name: 'Platform Admin',
      email: 'admin@nanoshipy.com',
      password_hash,
      role: 'super_admin',
      status: 'active',
    });
    console.log('Created default Platform Admin: admin@nanoshipy.com / admin@123');
  }

  // 2. Ensure Default Tenant & User
  let tenant = await Tenant.findOne({ where: { subdomain: 'test' } });
  if (!tenant) {
    tenant = await Tenant.create({
      company_name: 'Test Merchant Co.',
      subdomain: 'test',
      status: 'active',
    });

    let role = await Role.findOne({ where: { name: 'owner', tenant_id: tenant.id } });
    if (!role) {
      role = await Role.create({
        tenant_id: tenant.id,
        name: 'owner',
        is_system_role: true,
      });
    }

    const userHash = await hashUtils.hashPassword('test@123');
    await User.create({
      tenant_id: tenant.id,
      role_id: role.id,
      name: 'Test Seller',
      email: 'test@gmail.com',
      password_hash: userHash,
      phone: '9876543210',
      status: 'active',
      email_verified_at: new Date(),
    });

    await Wallet.create({
      tenant_id: tenant.id,
      balance: 10000.00,
      low_balance_threshold: 500.00,
      currency: 'INR',
    });

    console.log('Created default Test Seller: test@gmail.com / test@123 (subdomain: test)');
  }

  // 3. Ensure Payment Gateways
  const rzp = await PaymentGateway.findOne({ where: { name: 'razorpay' } });
  if (!rzp) {
    await PaymentGateway.create({
      name: 'razorpay',
      display_name: 'Razorpay Payment Gateway',
      mode: 'test',
      is_active: true,
      is_default: true,
      api_key: 'rzp_test_samplekey123',
      api_secret: 'sample_secret_key',
      webhook_secret: 'sample_webhook_secret',
      config: { min_recharge: 100, max_recharge: 500000, presets: [500, 1000, 2000, 5000], fee_percent: 0 },
    });
  }

  const manual = await PaymentGateway.findOne({ where: { name: 'manual' } });
  if (!manual) {
    await PaymentGateway.create({
      name: 'manual',
      display_name: 'Manual Bank Transfer',
      mode: 'live',
      is_active: true,
      is_default: false,
      config: { min_recharge: 500, max_recharge: 100000 },
    });
  }

  // 4. Ensure Courier Providers
  const mockCarrier = await CourierProvider.findOne({ where: { provider_key: 'mock' } });
  if (!mockCarrier) {
    await CourierProvider.create({
      name: 'Mock Express Courier',
      display_name: 'Mock Express Courier',
      provider_key: 'mock',
      is_active: true,
      credentials_encrypted: 'mock_credentials',
      config: { sandbox_mode: true },
    });
  }

  console.log('>>> SQLite Database Seeding Completed Successfully!');
  process.exit(0);
}

seedLocal().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
