const path = require('path');
const hashUtils = require('./src/utils/hash');
const { sequelize, PlatformAdmin, User, Tenant, Role, Permission, Wallet, WalletTransaction, Order, Shipment, CourierProvider, RateCard, PickupAddress, SubscriptionPlan, TenantSubscription } = require('./src/models');
const { PERMISSIONS } = require('./src/constants/permissions.constant');
const { v4: uuidv4 } = require('uuid');

async function setupLiveCredentials() {
  console.log('=== SETTING UP LIVE CREDENTIALS & FULL PERMISSIONS ON VPS ===\n');

  const adminHash = await hashUtils.hashPassword('Nanoshipy@202601');
  const merchantHash = await hashUtils.hashPassword('Demo@1234');

  // 1. Ensure all Permissions exist in DB
  const allDbPerms = [];
  for (const p of PERMISSIONS) {
    let [perm] = await Permission.findOrCreate({
      where: { key: p.key },
      defaults: {
        id: uuidv4(),
        key: p.key,
        module_name: p.module_name || 'general',
        description: p.description || p.key,
      },
    });
    allDbPerms.push(perm);
  }
  console.log(`Ensured ${allDbPerms.length} permissions exist in database.`);

  // 2. Ensure Tenant exists
  let tenant = await Tenant.findOne({ where: { subdomain: 'demo' } });
  if (!tenant) {
    tenant = await Tenant.findOne();
  }
  if (!tenant) {
    tenant = await Tenant.create({
      id: uuidv4(),
      company_name: 'Nanoshipy Demo Store',
      subdomain: 'demo',
      status: 'active',
      profile_completed: true,
      kyc_status: 'approved',
    });
    console.log('Created Tenant: Nanoshipy Demo Store');
  } else {
    await tenant.update({
      company_name: 'Nanoshipy Demo Store',
      status: 'active',
      profile_completed: true,
      kyc_status: 'approved'
    });
    console.log('Updated Tenant:', tenant.company_name, '(', tenant.id, ')');
  }

  // 3. Ensure Role exists and has ALL permissions attached
  let role = await Role.findOne({ where: { name: 'owner', tenant_id: tenant.id } });
  if (!role) {
    role = await Role.findOne({ where: { name: 'owner' } });
  }
  if (!role) {
    role = await Role.create({
      id: uuidv4(),
      tenant_id: tenant.id,
      name: 'owner',
      display_name: 'Store Owner',
      description: 'Full store owner permissions with all access',
    });
  }
  
  // Attach all permissions to the role
  if (role.setPermissions) {
    await role.setPermissions(allDbPerms);
    console.log(`Assigned all ${allDbPerms.length} permissions to role: ${role.name}`);
  }

  // Also assign to any global 'admin' role
  let globalAdminRole = await Role.findOne({ where: { name: 'admin' } });
  if (globalAdminRole && globalAdminRole.setPermissions) {
    await globalAdminRole.setPermissions(allDbPerms);
  }

  // 4. Ensure Wallet exists with positive balance for demo
  let wallet = await Wallet.findOne({ where: { tenant_id: tenant.id } });
  if (!wallet) {
    wallet = await Wallet.create({
      id: uuidv4(),
      tenant_id: tenant.id,
      balance: 15450.00,
      currency: 'INR',
      status: 'active',
    });
    console.log('Created Wallet with ₹15,450.00 demo balance');
  } else {
    if (parseFloat(wallet.balance || 0) < 1000) {
      await wallet.update({ balance: 15450.00 });
      console.log('Updated Wallet balance to ₹15,450.00');
    }
  }

  // 5. Ensure Pickup Address exists
  let pickup = await PickupAddress.findOne({ where: { tenant_id: tenant.id } });
  if (!pickup) {
    pickup = await PickupAddress.create({
      id: uuidv4(),
      tenant_id: tenant.id,
      label: 'Primary Warehouse',
      contact_name: 'Warehouse Manager',
      contact_phone: '9876543210',
      address_line1: 'Plot 45, Phase 2, Industrial Area',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
      pincode_verified: true,
    });
    console.log('Created Pickup Address for tenant');
  }

  // 6. Setup Platform Admins
  const adminEmails = ['care@nanoshipy.com', 'admin@nanoshipy.com', 'admin@gmail.com'];
  for (const email of adminEmails) {
    let admin = await PlatformAdmin.findOne({ where: { email } });
    if (admin) {
      await admin.update({
        password_hash: adminHash,
        status: 'active',
        role: 'super_admin',
        two_factor_enabled: false,
      });
      console.log('Updated Platform Admin:', email);
    } else {
      admin = await PlatformAdmin.create({
        id: uuidv4(),
        name: 'Super Admin',
        email: email,
        password_hash: adminHash,
        role: 'super_admin',
        status: 'active',
        two_factor_enabled: false,
      });
      console.log('Created Platform Admin:', email);
    }
  }

  // 7. Setup Demo Merchant (Single official demo seller account)
  const officialMerchantEmail = 'demo@gmail.com';
  let merchantUser = await User.findOne({ where: { email: officialMerchantEmail } });
  if (merchantUser) {
    await merchantUser.update({
      tenant_id: tenant.id,
      role_id: role.id,
      password_hash: merchantHash,
      status: 'active',
      email_verified_at: new Date(),
      two_factor_enabled: false,
    });
  } else {
    merchantUser = await User.create({
      id: uuidv4(),
      tenant_id: tenant.id,
      role_id: role.id,
      name: 'Demo Merchant',
      email: officialMerchantEmail,
      password_hash: merchantHash,
      status: 'active',
      email_verified_at: new Date(),
      two_factor_enabled: false,
    });
  }
  console.log('✅ Retained official Demo Merchant User:', officialMerchantEmail);

  // 8. Clean out all fake / dummy test orders, shipments, stray tenants, and extra users
  if (sequelize) {
    try {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
      try { await sequelize.query('DELETE FROM tracking_events;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM ndr_records;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM rto_records;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM order_items;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM shipment_items;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM shipments;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM orders;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM invoices;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM webhook_logs;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM wallet_recharge_transactions;'); } catch (_) {}
      try { await sequelize.query('DELETE FROM wallet_transactions;'); } catch (_) {}
      try { await sequelize.query("DELETE FROM users WHERE email != 'demo@gmail.com';"); } catch (_) {}
      try { await sequelize.query("DELETE FROM tenants WHERE subdomain != 'demo';"); } catch (_) {}
      try { await sequelize.query("DELETE FROM wallets WHERE tenant_id != '" + tenant.id + "';"); } catch (_) {}
      try { await sequelize.query("DELETE FROM pickup_addresses WHERE tenant_id != '" + tenant.id + "';"); } catch (_) {}
      await sequelize.query('PRAGMA foreign_keys = ON;');
      console.log('✅ Cleaned all demo/dummy orders, shipments, stray tenants, and logs.');
    } catch (cleanErr) {
      console.error('Error cleaning demo records:', cleanErr.message);
    }
  }

  // 9. Sync Official Subscription Plans with Nanoshipy.com pricing
  if (SubscriptionPlan) {
    const plansToSync = [
      {
        name: 'Starter',
        slug: 'starter',
        price_monthly: 0.00,
        price_yearly: 0.00,
        max_orders_per_month: 500,
        courier_access_tier: 'basic',
        support_tier: 'email',
        is_active: true,
        is_default: true,
        sort_order: 0,
      },
      {
        name: 'Growth',
        slug: 'growth',
        price_monthly: 1999.00,
        price_yearly: 19188.00,
        max_orders_per_month: 10000,
        courier_access_tier: 'all',
        support_tier: 'priority',
        is_active: true,
        is_default: false,
        sort_order: 1,
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        price_monthly: 5999.00,
        price_yearly: 57588.00,
        max_orders_per_month: null,
        courier_access_tier: 'all',
        support_tier: 'dedicated',
        is_active: true,
        is_default: false,
        sort_order: 2,
      },
    ];

    for (const p of plansToSync) {
      let existing = await SubscriptionPlan.findOne({ where: { slug: p.slug } });
      if (existing) {
        await existing.update(p);
      } else {
        await SubscriptionPlan.create({ id: uuidv4(), ...p });
      }
    }
    console.log('✅ Synced 3 official subscription plans with live pricing rates.');
  }

  console.log('\n=== TESTING LOGINS NOW ===');
  const platformAuthService = require('./src/services/platformAuth.service');
  const authService = require('./src/services/auth.service');

  try {
    const adminRes = await platformAuthService.login('care@nanoshipy.com', 'Nanoshipy@202601', '127.0.0.1');
    console.log('✅ care@nanoshipy.com login SUCCESS:', adminRes?.access_token ? 'Token generated' : 'OK');
  } catch (e) {
    console.log('❌ care@nanoshipy.com login FAILED:', e.message);
  }

  try {
    const userRes = await authService.login({ email: 'demo@gmail.com', password: 'Demo@1234', ipAddress: '127.0.0.1' }, { headers: { 'x-forwarded-for': '127.0.0.1' } });
    console.log('✅ demo@gmail.com login SUCCESS:', userRes?.access_token ? 'Token generated' : 'OK');
  } catch (e) {
    console.log('❌ demo@gmail.com login FAILED:', e.message);
  }

  process.exit(0);
}

setupLiveCredentials().catch(err => {
  console.error('Setup Error:', err);
  process.exit(1);
});
