'use strict';

require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Tenant, PlatformAdmin, Role, Permission, RolePermission, Wallet, PaymentGateway } = require('./src/models');
const { PERMISSIONS } = require('./src/constants/permissions.constant');
const { encrypt } = require('./src/utils/encryption.util');

async function seedAllAccounts() {
  console.log('[Seed] Database schema already managed by migrations.');
  // await sequelize.sync({ force: false });

  // 1. Upsert Super Admin account admin-care@nanoshipy.com / Nanoshipy@2026
  console.log('[Seed] Updating Super Admin accounts...');
  const adminPasswordHash = await bcrypt.hash('Nanoshipy@2026', 10);
  
  // Find or update admin-care@nanoshipy.com
  let [admin, adminCreated] = await PlatformAdmin.findOrCreate({
    where: { email: 'admin-care@nanoshipy.com' },
    defaults: {
      name: 'Nanoshipy Super Admin',
      email: 'admin-care@nanoshipy.com',
      password_hash: adminPasswordHash,
      role: 'super_admin',
      status: 'active',
    },
  });

  if (!adminCreated) {
    admin.password_hash = adminPasswordHash;
    admin.status = 'active';
    admin.role = 'super_admin';
    await admin.save();
  }

  // Also maintain alias admin accounts for local convenience
  const oldAdmins = ['admin@nanoshipy.com', 'admin@gmail.com'];
  for (const oldEmail of oldAdmins) {
    const existing = await PlatformAdmin.findOne({ where: { email: oldEmail } });
    if (existing) {
      existing.password_hash = adminPasswordHash;
      existing.status = 'active';
      await existing.save();
    }
  }
  console.log('[Seed] Super Admin account active: admin-care@nanoshipy.com / Nanoshipy@2026');

  // 2. Upsert Merchant Tenant 'demo'
  let [tenant, tenantCreated] = await Tenant.findOrCreate({
    where: { subdomain: 'demo' },
    defaults: {
      company_name: 'Nanoshipy Demo Store',
      subdomain: 'demo',
      status: 'active',
      kyc_status: 'approved',
      gstin: '27AAAAA0000A1Z5',
      legal_name: 'Nanoshipy Logistics Private Limited',
      company_email: 'demo@nanoshipy.com',
      company_phone: '9876543210',
    },
  });

  if (!tenantCreated) {
    tenant.company_name = 'Nanoshipy Demo Store';
    tenant.status = 'active';
    tenant.kyc_status = 'approved';
    await tenant.save();
  }
  console.log(`[Seed] Tenant set: ID=${tenant.id}, Subdomain=${tenant.subdomain}`);

  // 3. Seed System Permissions
  const permissionIds = [];
  for (const item of PERMISSIONS) {
    const [perm] = await Permission.findOrCreate({
      where: { key: item.key },
      defaults: {
        key: item.key,
        module_name: item.module_name,
        description: item.description,
      },
    });
    permissionIds.push(perm.id);
  }
  console.log(`[Seed] System permissions verified: ${permissionIds.length} permissions`);

  // 4. Ensure Owner Role for Demo Tenant
  const [role] = await Role.findOrCreate({
    where: { tenant_id: tenant.id, name: 'Owner' },
    defaults: {
      tenant_id: tenant.id,
      name: 'Owner',
      description: 'Account Owner with full access',
      is_system: true,
    },
  });

  // 5. Ensure Wallet for Demo Tenant (Initial ₹10,000 balance)
  const [wallet, walletCreated] = await Wallet.findOrCreate({
    where: { tenant_id: tenant.id },
    defaults: { tenant_id: tenant.id, balance: 10000.0, low_balance_threshold: 500.0 },
  });
  if (!walletCreated && wallet.balance < 1000) {
    wallet.balance = 10000.0;
    await wallet.save();
  }
  console.log(`[Seed] Wallet set: Balance=₹${wallet.balance}`);

  // 6. Attach All Permissions to Owner Role
  for (const pId of permissionIds) {
    await RolePermission.findOrCreate({
      where: { role_id: role.id, permission_id: pId },
      defaults: { role_id: role.id, permission_id: pId },
    });
  }

  // 7. Upsert Merchant User demo@nanoshipy.com / Demo@2026
  console.log('[Seed] Updating User accounts...');
  const userPasswordHash = await bcrypt.hash('Demo@2026', 10);
  let [user, userCreated] = await User.findOrCreate({
    where: { email: 'demo@nanoshipy.com' },
    defaults: {
      tenant_id: tenant.id,
      role_id: role.id,
      name: 'Nanoshipy Demo Merchant',
      email: 'demo@nanoshipy.com',
      password_hash: userPasswordHash,
      status: 'active',
      email_verified_at: new Date(),
    },
  });

  if (!userCreated) {
    user.tenant_id = tenant.id;
    user.role_id = role.id;
    user.name = 'Nanoshipy Demo Merchant';
    user.password_hash = userPasswordHash;
    user.status = 'active';
    user.email_verified_at = new Date();
    await user.save();
  }

  // Also maintain alias user accounts
  const oldUsers = ['demo@gmail.com', 'test@gmail.com'];
  for (const oldEmail of oldUsers) {
    const existing = await User.findOne({ where: { email: oldEmail } });
    if (existing) {
      existing.password_hash = userPasswordHash;
      existing.status = 'active';
      await existing.save();
    }
  }
  console.log('[Seed] Merchant User active: demo@nanoshipy.com / Demo@2026 (subdomain: demo)');

  // 8. Seed Default Payment Gateways (Razorpay, Cashfree, PayU, PhonePe)
  console.log('[Seed] Seeding default payment gateways...');
  await PaymentGateway.sync().catch(err => console.warn(err.message));
  const gatewaysToSeed = [
    {
      name: 'razorpay',
      display_name: 'Razorpay',
      mode: 'live',
      api_key: process.env.RAZORPAY_KEY_ID || 'rzp_live_demoKey123',
      api_secret: process.env.RAZORPAY_KEY_SECRET ? encrypt(process.env.RAZORPAY_KEY_SECRET) : null,
      webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET ? encrypt(process.env.RAZORPAY_WEBHOOK_SECRET) : null,
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
      api_key: null,
      api_secret: null,
      webhook_secret: null,
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
      display_name: 'PayU',
      mode: 'test',
      api_key: null,
      api_secret: null,
      webhook_secret: null,
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
      name: 'phonepe',
      display_name: 'PhonePe PG',
      mode: 'test',
      api_key: null,
      api_secret: null,
      webhook_secret: null,
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
  ];

  for (const gwData of gatewaysToSeed) {
    const [gw, gwCreated] = await PaymentGateway.findOrCreate({
      where: { name: gwData.name },
      defaults: gwData,
    });
    if (!gwCreated && gwData.name === 'razorpay') {
      await gw.update({
        is_active: true,
        is_default: true,
        api_key: gwData.api_key || gw.api_key,
      });
    }
  }
  console.log('[Seed] Payment Gateways seeded successfully (Razorpay, Cashfree, PayU, PhonePe)');

  console.log('\n======================================================');
  console.log('NANOSHIPY SEED COMPLETED SUCCESSFULLY:');
  console.log('  Admin Portal Login:');
  console.log('    URL:      http://localhost:3001/login  (or https://admin.nanoshipy.com)');
  console.log('    Email:    admin-care@nanoshipy.com');
  console.log('    Password: Nanoshipy@2026');
  console.log('  Merchant Portal Login:');
  console.log('    URL:      http://localhost:3000/login  (or https://app.nanoshipy.com)');
  console.log('    Email:    demo@nanoshipy.com');
  console.log('    Password: Demo@2026');
  console.log('======================================================\n');

  process.exit(0);
}

seedAllAccounts().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
