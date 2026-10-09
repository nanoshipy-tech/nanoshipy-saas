'use strict';

const bcrypt = require('bcrypt');
const { Client } = require('pg');

const dbConfig = {
  user: 'nanoshipy_user',
  password: 'nanoshipy_password_2026!',
  host: '127.0.0.1',
  port: 5432,
  database: 'nanoshipy_db',
};

async function main() {
  const client = new Client(dbConfig);
  await client.connect();
  console.log('Connected to PostgreSQL database...');

  try {
    // 1. Superadmin Platform Account (supports Nanoshipy@202601)
    console.log('1. Setting up Superadmin: care@nanoshipy.com / Nanoshipy@202601...');
    const adminPasswordHash = await bcrypt.hash('Nanoshipy@202601', 10);
    const adminCheck = await client.query('SELECT id FROM platform_admins WHERE email = $1', ['care@nanoshipy.com']);
    
    if (adminCheck.rows.length > 0) {
      await client.query('UPDATE platform_admins SET password_hash = $1, status = $2, name = $3 WHERE id = $4', [
        adminPasswordHash,
        'active',
        'Nanoshipy Admin',
        adminCheck.rows[0].id,
      ]);
    } else {
      await client.query(
        'INSERT INTO platform_admins (id, name, email, password_hash, role, status, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())',
        ['Nanoshipy Admin', 'care@nanoshipy.com', adminPasswordHash, 'super_admin', 'active']
      );
    }
    console.log('✓ Superadmin account ready');

    // 2. Demo Tenant
    console.log('2. Setting up Demo Tenant...');
    let tenantRes = await client.query('SELECT id FROM tenants WHERE subdomain = $1 LIMIT 1', ['demo']);
    let tenantId;
    if (tenantRes.rows.length > 0) {
      tenantId = tenantRes.rows[0].id;
      await client.query('UPDATE tenants SET status = $1, company_name = $2 WHERE id = $3', [
        'active',
        'Nanoshipy Demo Store',
        tenantId,
      ]);
    } else {
      const inserted = await client.query(
        'INSERT INTO tenants (id, company_name, subdomain, status, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING id',
        ['Nanoshipy Demo Store', 'demo', 'active']
      );
      tenantId = inserted.rows[0].id;
    }
    console.log('✓ Demo Tenant ready');

    // 3. Demo Merchant Users (demo@nanoshipy.com & demo@gmail.com)
    console.log('3. Setting up Demo Merchants...');
    const roleCheck = await client.query("SELECT id FROM roles WHERE name = 'owner' OR name = 'admin' LIMIT 1");
    const roleId = roleCheck.rows[0]?.id || null;

    const merchants = [
      { email: 'demo@nanoshipy.com', pass: 'Demo@202601', name: 'Demo Merchant' },
      { email: 'demo@gmail.com', pass: 'Demo@1234', name: 'Demo Merchant' },
    ];

    for (const m of merchants) {
      const hash = await bcrypt.hash(m.pass, 10);
      const userCheck = await client.query('SELECT id FROM users WHERE email = $1', [m.email]);
      if (userCheck.rows.length > 0) {
        await client.query(
          'UPDATE users SET password_hash = $1, tenant_id = $2, name = $3, status = $4, role_id = $5, email_verified_at = NOW() WHERE id = $6',
          [hash, tenantId, m.name, 'active', roleId, userCheck.rows[0].id]
        );
      } else {
        await client.query(
          'INSERT INTO users (id, tenant_id, role_id, name, email, password_hash, status, email_verified_at, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())',
          [tenantId, roleId, m.name, m.email, hash, 'active']
        );
      }
      console.log(`✓ Merchant ${m.email} ready`);
    }

    // 4. Tenant Wallet
    console.log('4. Setting up Tenant Wallet with ₹5,000.00...');
    const walletCheck = await client.query('SELECT id FROM wallets WHERE tenant_id = $1', [tenantId]);
    if (walletCheck.rows.length > 0) {
      await client.query('UPDATE wallets SET balance = $1, currency = $2, updated_at = NOW() WHERE tenant_id = $3', [
        5000.00,
        'INR',
        tenantId,
      ]);
    } else {
      await client.query(
        'INSERT INTO wallets (id, tenant_id, balance, currency, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())',
        [tenantId, 5000.00, 'INR']
      );
    }
    console.log('✓ Tenant Wallet ready');

    // 5. Tenant Pickup Address
    console.log('5. Setting up Tenant Pickup Address...');
    const addrCheck = await client.query('SELECT id FROM pickup_addresses WHERE tenant_id = $1', [tenantId]);
    if (addrCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO pickup_addresses (id, tenant_id, label, contact_name, contact_phone, address_line1, city, state, pincode, is_default, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'Central Warehouse', 'Demo Admin', '9150826341', 'Plot 45, Sector 62', 'Noida', 'Uttar Pradesh', '201301', true, true, NOW(), NOW())`,
        [tenantId]
      );
    }
    console.log('✓ Pickup address ready');

    // 6. Payment Gateways
    console.log('6. Seeding Payment Gateways...');
    const pgConfig = JSON.stringify({
      min_recharge: 500,
      max_recharge: 100000,
      presets: [500, 1000, 2000, 5000],
      fee_percent: 0,
      auto_gst_invoice: true,
      gst_percent: 18,
    });

    await client.query(`
      INSERT INTO payment_gateways (id, name, display_name, mode, api_key, is_active, is_default, config, created_at, updated_at)
      VALUES
        (gen_random_uuid(), 'razorpay', 'Razorpay', 'test', '', true, true, '${pgConfig}', NOW(), NOW()),
        (gen_random_uuid(), 'cashfree', 'Cashfree Payments', 'test', '', false, false, '${pgConfig}', NOW(), NOW()),
        (gen_random_uuid(), 'manual', 'Manual / Bank Transfer', 'live', 'MANUAL_OFFLINE', true, false, '${pgConfig}', NOW(), NOW())
      ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active, updated_at = NOW();
    `);
    console.log('✓ Payment gateways ready');

    // 7. Grant All Permissions to Roles
    console.log('7. Granting all permissions to system roles...');
    const perms = await client.query('SELECT id FROM permissions');
    const roles = await client.query('SELECT id FROM roles');
    for (const r of roles.rows) {
      for (const p of perms.rows) {
        await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
          r.id,
          p.id,
        ]);
      }
    }
    console.log('✓ Role permissions assigned');

    console.log('\n=== ALL ESSENTIAL DATA SEEDED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Error during seeding:', err);
  } finally {
    await client.end();
  }
}

main();
