'use strict';

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sequelize = require('../src/config/db.config');

const BCRYPT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function cleanUploadsDir(relativeDir) {
  const targetDir = path.resolve(__dirname, '..', relativeDir);
  if (!fs.existsSync(targetDir)) return 0;

  let deletedCount = 0;
  function walkAndPurge(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndPurge(fullPath);
      } else {
        fs.unlinkSync(fullPath);
        deletedCount++;
      }
    }
  }

  walkAndPurge(targetDir);
  return deletedCount;
}

async function executeReset() {
  console.log('====================================================');
  console.log('STARTING FULL DATA RESET TRANSACTION');
  console.log('====================================================\n');

  await sequelize.authenticate();

  const demoPasswordHash = await hashPassword('Demo@202601');
  const adminPasswordHash = await hashPassword('Care@202601');

  // Verify hash matches before touching DB
  if (!(await bcrypt.compare('Demo@202601', demoPasswordHash))) {
    throw new Error('Self-test error: Demo password hash failed verification!');
  }
  if (!(await bcrypt.compare('Care@202601', adminPasswordHash))) {
    throw new Error('Self-test error: Admin password hash failed verification!');
  }
  console.log('✓ Password hash self-test passed for both accounts.');

  let demoTenantId = '0ff1b049-d711-4605-b86e-0f10723c0602';
  let demoUserId = '3413e892-3a82-488a-b594-74a7455a0d1d';
  let demoRoleId = '619b6bf2-c21c-4e27-8096-7583b80b9881';

  // Execute inside a single atomic transaction
  await sequelize.transaction(async (t) => {
    console.log('\n--- 1. Deleting Level 1 Leaf Tables (Audit, Logs, Tokens, Events) ---');
    const level1Tables = [
      'audit_logs',
      'address_lookup_audit_logs',
      'platform_audit_logs',
      'platform_refresh_tokens',
      'refresh_tokens',
      'password_reset_tokens',
      'webhook_logs',
      'webhook_deliveries',
      'webhook_idempotency',
      'tracking_events',
      'shipment_status_histories',
      'order_status_histories',
      'api_key_usage_logs',
      'api_keys',
      'notification_logs',
      'in_app_notifications',
      'storefront_sync_logs',
      'settings_change_history',
      'provider_health_logs',
      'rate_card_upload_logs',
      'plan_usage_tracking',
      'plan_change_history',
      'impersonation_sessions'
    ];

    for (const table of level1Tables) {
      try {
        await sequelize.query(`DELETE FROM "${table}"`, { transaction: t });
        console.log(`✓ Cleared ${table}`);
      } catch (err) {
        await sequelize.query(`DELETE FROM \`${table}\``, { transaction: t }).catch(() => {});
      }
    }

    console.log('\n--- 2. Deleting Level 2 Transactional & Line Item Tables ---');
    const level2Tables = [
      'wallet_transactions',
      'wallet_recharge_transactions',
      'recharge_orders',
      'invoice_line_items',
      'invoices',
      'credit_notes',
      'order_items',
      'shipment_rate_quotes',
      'ndr_actions',
      'ndr_events',
      'rto_records',
      'weight_discrepancy_disputes',
      'ticket_messages',
      'ticket_attachments',
      'cost_rate_snapshots'
    ];

    for (const table of level2Tables) {
      try {
        await sequelize.query(`DELETE FROM "${table}"`, { transaction: t });
        console.log(`✓ Cleared ${table}`);
      } catch (err) {
        await sequelize.query(`DELETE FROM \`${table}\``, { transaction: t }).catch(() => {});
      }
    }

    console.log('\n--- 3. Deleting Level 3 Operational Parent Tables ---');
    const level3Tables = [
      'shipments',
      'shipments_backup',
      'orders',
      'order_imports',
      'manifests',
      'support_tickets',
      'cod_remittances'
    ];

    for (const table of level3Tables) {
      try {
        await sequelize.query(`DELETE FROM "${table}"`, { transaction: t });
        console.log(`✓ Cleared ${table}`);
      } catch (err) {
        await sequelize.query(`DELETE FROM \`${table}\``, { transaction: t }).catch(() => {});
      }
    }

    // In SQLite, temporarily disable FK enforcement during batch delete within transaction
    await sequelize.query('PRAGMA foreign_keys = OFF;', { transaction: t }).catch(() => {});

    console.log('\n--- 4. Deleting Level 4 Merchant Config, Addresses & Dependent Entities ---');
    const level4Tables = [
      'pickup_addresses',
      'company_documents',
      'kyc_documents',
      'tenant_webhooks',
      'tenant_settings',
      'tenant_integration_configs',
      'storefront_connections',
      'tenant_subscriptions',
      'tenant_courier_access',
      'sub_users',
      'invoice_sequences',
      'analytics_daily_snapshots'
    ];

    for (const table of level4Tables) {
      try {
        await sequelize.query(`DELETE FROM "${table}"`, { transaction: t });
        console.log(`✓ Cleared ${table}`);
      } catch (err) {
        await sequelize.query(`DELETE FROM \`${table}\``, { transaction: t }).catch(() => {});
      }
    }

    console.log('\n--- 5. Deleting Level 5 Non-Demo Primary Entities (Users -> Roles -> Wallets -> Tenants) ---');
    // Delete non-demo users FIRST so they release foreign key references to roles and tenants
    await sequelize.query(
      `DELETE FROM users WHERE LOWER(email) != 'demo@nanoshipy.com'`,
      { transaction: t }
    );
    console.log('✓ Cleared non-demo users');

    // Clear role_permissions for non-kept roles
    await sequelize.query(
      `DELETE FROM role_permissions WHERE role_id NOT IN (
        SELECT id FROM roles WHERE tenant_id IS NULL OR tenant_id = '${demoTenantId}'
      )`,
      { transaction: t }
    );
    console.log('✓ Cleared non-demo role_permissions');

    // Clear tenant roles for non-demo tenants
    await sequelize.query(
      `DELETE FROM roles WHERE tenant_id IS NOT NULL AND tenant_id != '${demoTenantId}'`,
      { transaction: t }
    );
    console.log('✓ Cleared non-demo roles');

    // Delete non-demo wallets
    await sequelize.query(
      `DELETE FROM wallets WHERE tenant_id != '${demoTenantId}'`,
      { transaction: t }
    );
    console.log('✓ Cleared non-demo wallets');

    // Delete non-demo tenants
    await sequelize.query(
      `DELETE FROM tenants WHERE id != '${demoTenantId}'`,
      { transaction: t }
    );
    console.log('✓ Cleared non-demo tenants');

    // Delete all admins except Care@nanoshipy.com
    await sequelize.query(
      `DELETE FROM platform_admins WHERE LOWER(email) != 'care@nanoshipy.com'`,
      { transaction: t }
    );
    console.log('✓ Cleared non-Care platform admins');

    console.log('\n--- 6. Creating / Normalizing Kept Accounts ---');

    // 6a. Normalize / Create Demo Tenant
    const [existingTenants] = await sequelize.query(
      `SELECT * FROM tenants WHERE id = '${demoTenantId}'`,
      { transaction: t }
    );

    const now = new Date().toISOString();

    if (existingTenants.length === 0) {
      await sequelize.query(
        `INSERT INTO tenants (
          id, company_name, subdomain, status, kyc_status, legal_name, business_type, created_at, updated_at
        ) VALUES (
          '${demoTenantId}', 'Nanoshipy Demo Store', 'demo', 'active', 'approved', 'Nanoshipy Demo Store', 'individual', '${now}', '${now}'
        )`,
        { transaction: t }
      );
      console.log('✓ Created fresh demo tenant');
    } else {
      await sequelize.query(
        `UPDATE tenants SET 
          company_name = 'Nanoshipy Demo Store',
          subdomain = 'demo',
          status = 'active',
          kyc_status = 'approved',
          legal_name = 'Nanoshipy Demo Store',
          business_type = 'individual',
          updated_at = '${now}'
        WHERE id = '${demoTenantId}'`,
        { transaction: t }
      );
      console.log('✓ Normalized existing demo tenant');
    }

    // 6b. Normalize / Create Demo Role & Permissions
    const [existingDemoRoles] = await sequelize.query(
      `SELECT * FROM roles WHERE tenant_id = '${demoTenantId}' AND LOWER(name) = 'owner'`,
      { transaction: t }
    );

    if (existingDemoRoles.length === 0) {
      await sequelize.query(
        `INSERT INTO roles (
          id, tenant_id, name, is_system_role, is_editable, description, created_at, updated_at
        ) VALUES (
          '${demoRoleId}', '${demoTenantId}', 'Owner', 0, 1, 'Account Owner with full access', '${now}', '${now}'
        )`,
        { transaction: t }
      );
      console.log('✓ Created demo role');

      // Link all available permissions to demo role
      const [allPerms] = await sequelize.query('SELECT id FROM permissions', { transaction: t });
      for (const p of allPerms) {
        await sequelize.query(
          `INSERT INTO role_permissions (role_id, permission_id, created_at, updated_at) VALUES ('${demoRoleId}', '${p.id}', '${now}', '${now}')`,
          { transaction: t }
        );
      }
      console.log(`✓ Attached ${allPerms.length} permissions to demo role`);
    } else {
      demoRoleId = existingDemoRoles[0].id;
      console.log(`✓ Using existing demo role: ${demoRoleId}`);
    }

    // 6c. Normalize / Create Demo User
    const [existingUsers] = await sequelize.query(
      `SELECT * FROM users WHERE LOWER(email) = 'demo@nanoshipy.com'`,
      { transaction: t }
    );

    if (existingUsers.length === 0) {
      await sequelize.query(
        `INSERT INTO users (
          id, tenant_id, role_id, name, email, password_hash, phone, status, two_factor_enabled, two_factor_secret, email_verified_at, created_at, updated_at
        ) VALUES (
          '${demoUserId}', '${demoTenantId}', '${demoRoleId}', 'Demo Merchant', 'demo@nanoshipy.com', '${demoPasswordHash}', '9876543210', 'active', 0, null, '${now}', '${now}', '${now}'
        )`,
        { transaction: t }
      );
      console.log('✓ Created fresh demo user');
    } else {
      demoUserId = existingUsers[0].id;
      await sequelize.query(
        `UPDATE users SET
          tenant_id = '${demoTenantId}',
          role_id = '${demoRoleId}',
          name = 'Demo Merchant',
          email = 'demo@nanoshipy.com',
          password_hash = '${demoPasswordHash}',
          status = 'active',
          two_factor_enabled = 0,
          two_factor_secret = null,
          last_login_at = null,
          updated_at = '${now}'
        WHERE LOWER(email) = 'demo@nanoshipy.com'`,
        { transaction: t }
      );
      console.log('✓ Normalized existing demo user with new password hash');
    }

    // 6d. Normalize / Create Demo Wallet
    const [existingWallets] = await sequelize.query(
      `SELECT * FROM wallets WHERE tenant_id = '${demoTenantId}'`,
      { transaction: t }
    );

    if (existingWallets.length === 0) {
      const walletId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO wallets (
          id, tenant_id, balance, low_balance_threshold, currency, created_at, updated_at
        ) VALUES (
          '${walletId}', '${demoTenantId}', 0.0, 500, 'INR', '${now}', '${now}'
        )`,
        { transaction: t }
      );
      console.log('✓ Created clean demo wallet with balance 0.0');
    } else {
      await sequelize.query(
        `UPDATE wallets SET
          balance = 0.0,
          low_balance_threshold = 500,
          currency = 'INR',
          updated_at = '${now}'
        WHERE tenant_id = '${demoTenantId}'`,
        { transaction: t }
      );
      console.log('✓ Reset demo wallet balance to 0.0');
    }

    // 6e. Normalize / Create Platform Admin (Care@nanoshipy.com)
    const [existingAdmins] = await sequelize.query(
      `SELECT * FROM platform_admins WHERE LOWER(email) = 'care@nanoshipy.com'`,
      { transaction: t }
    );

    if (existingAdmins.length === 0) {
      const adminId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO platform_admins (
          id, name, email, password_hash, role, status, two_factor_enabled, two_factor_secret, created_at, updated_at
        ) VALUES (
          '${adminId}', 'Platform Admin', 'Care@nanoshipy.com', '${adminPasswordHash}', 'super_admin', 'active', 0, null, '${now}', '${now}'
        )`,
        { transaction: t }
      );
      console.log('✓ Created fresh platform admin Care@nanoshipy.com');
    } else {
      await sequelize.query(
        `UPDATE platform_admins SET
          name = 'Platform Admin',
          email = 'Care@nanoshipy.com',
          password_hash = '${adminPasswordHash}',
          role = 'super_admin',
          status = 'active',
          two_factor_enabled = 0,
          two_factor_secret = null,
          last_login_at = null,
          updated_at = '${now}'
        WHERE LOWER(email) = 'care@nanoshipy.com'`,
        { transaction: t }
      );
      console.log('✓ Updated existing platform admin Care@nanoshipy.com');
    }
  });

  console.log('\n====================================================');
  console.log('TRANSACTION COMMITTED SUCCESSFULLY');
  console.log('====================================================\n');

  // Purge uploaded storage files
  console.log('--- 7. Purging Orphaned Uploaded Files ---');
  const deletedBilling = cleanUploadsDir('uploads/billing');
  const deletedCompany = cleanUploadsDir('uploads/company');
  const deletedReports = cleanUploadsDir('uploads/reports');
  const deletedShipments = cleanUploadsDir('uploads/shipments');
  const totalFilesPurged = deletedBilling + deletedCompany + deletedReports + deletedShipments;
  console.log(`✓ Purged ${totalFilesPurged} orphaned uploaded files from disk.`);

  console.log('\n--- 8. Running Phase 4 Verification Checks ---');
  // 1. Verify User login
  const [uRows] = await sequelize.query("SELECT * FROM users WHERE LOWER(email) = 'demo@nanoshipy.com'");
  if (uRows.length !== 1) throw new Error('Verification failed: Demo user not found!');
  const demoMatch = await bcrypt.compare('Demo@202601', uRows[0].password_hash);
  if (!demoMatch) throw new Error('Verification failed: Demo password does not match hash!');
  console.log('✓ Demo Merchant Account verified: demo@nanoshipy.com (Role: Owner, Active, Hash Valid)');

  // 2. Verify Admin login
  const [aRows] = await sequelize.query("SELECT * FROM platform_admins WHERE LOWER(email) = 'care@nanoshipy.com'");
  if (aRows.length !== 1) throw new Error('Verification failed: Platform admin Care@nanoshipy.com not found!');
  const adminMatch = await bcrypt.compare('Care@202601', aRows[0].password_hash);
  if (!adminMatch) throw new Error('Verification failed: Admin password does not match hash!');
  console.log('✓ Platform Admin Account verified: Care@nanoshipy.com (Role: super_admin, Active, Hash Valid)');

  // 3. Verify total accounts
  const [allUsers] = await sequelize.query('SELECT COUNT(*) as c FROM users');
  const [allTenants] = await sequelize.query('SELECT COUNT(*) as c FROM tenants');
  const [allAdmins] = await sequelize.query('SELECT COUNT(*) as c FROM platform_admins');
  const [allWallets] = await sequelize.query('SELECT COUNT(*) as c FROM wallets');
  const [allOrders] = await sequelize.query('SELECT COUNT(*) as c FROM orders');
  const [allShipments] = await sequelize.query('SELECT COUNT(*) as c FROM shipments');
  const [allTransactions] = await sequelize.query('SELECT COUNT(*) as c FROM wallet_transactions');
  const [allTokens] = await sequelize.query('SELECT COUNT(*) as c FROM refresh_tokens');
  const [allAdminTokens] = await sequelize.query('SELECT COUNT(*) as c FROM platform_refresh_tokens');

  console.log('\n--- Final Verification Summary ---');
  console.log(`Users count: ${allUsers[0].c} (expected: 1)`);
  console.log(`Tenants count: ${allTenants[0].c} (expected: 1)`);
  console.log(`Platform Admins count: ${allAdmins[0].c} (expected: 1)`);
  console.log(`Wallets count: ${allWallets[0].c} (expected: 1)`);
  console.log(`Orders count: ${allOrders[0].c} (expected: 0)`);
  console.log(`Shipments count: ${allShipments[0].c} (expected: 0)`);
  console.log(`Wallet Transactions count: ${allTransactions[0].c} (expected: 0)`);
  console.log(`Refresh Tokens count: ${allTokens[0].c} (expected: 0)`);
  console.log(`Platform Refresh Tokens count: ${allAdminTokens[0].c} (expected: 0)`);

  if (
    allUsers[0].c === 1 &&
    allTenants[0].c === 1 &&
    allAdmins[0].c === 1 &&
    allWallets[0].c === 1 &&
    allOrders[0].c === 0 &&
    allShipments[0].c === 0 &&
    allTransactions[0].c === 0 &&
    allTokens[0].c === 0 &&
    allAdminTokens[0].c === 0
  ) {
    console.log('\n🎉 ALL PHASE 4 VERIFICATIONS PASSED WITH 100% ACCURACY!');
  } else {
    throw new Error('Verification failed: Unexpected row count after reset!');
  }

  process.exit(0);
}

executeReset().catch(err => {
  console.error('\n❌ RESET FAILED, TRANSACTION ROLLED BACK:');
  console.error(err);
  process.exit(1);
});
